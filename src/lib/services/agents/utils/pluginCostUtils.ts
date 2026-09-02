import { homedir } from 'node:os';

import { runClaudeCli } from './claudeCliUtils';

import type { ClaudeCliRunner } from './claudeCliUtils';
import type { ProjectUsage } from './usageUtils';

export interface PluginCostEstimate {
  readonly plugin: string;
  readonly alwaysOnTokens: number;
  readonly onInvokeTokens: number;
}

export interface PluginCostAttribution {
  readonly plugin: string;
  readonly alwaysOnTokens: number;
  readonly onInvokeTokens: number;
  readonly estimatedCostUsd: number;
}

export interface PluginCostPlugin {
  readonly id: string;
  readonly enabled: boolean;
}

export interface PluginDetailsInput {
  readonly plugins: readonly PluginCostPlugin[];
  readonly home?: string | undefined;
}

const TOKEN_PATTERN = /~\s*[\d,.]+k?/gu;

/**
 * Details reports estimates as "~449 tok" or "~1.1k", where the suffix scales
 * by 1000. The digit class also admits shapes like "1.2.3" that Number reads
 * as NaN, so a token that does not parse is skipped rather than trusted.
 */
const peakTokensIn = (text: string): number => {
  let peak = 0;

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const token = match[0].replace('~', '').trim();
    const scaled = token.endsWith('k');
    const digits = scaled ? token.slice(0, -1) : token;
    const base = Number(digits.replaceAll(',', ''));

    if (Number.isFinite(base)) {
      peak = Math.max(peak, scaled ? base * 1000 : base);
    }
  }

  return peak;
};

export const parsePluginDetails = (output: string): Omit<PluginCostEstimate, 'plugin'> => {
  const lines = output.split('\n');
  const alwaysOnLine = lines.find((line) => {
    return line.includes('Always-on');
  }) ?? '';
  const perComponentStart = lines.findIndex((line) => {
    return line.includes('Per-component');
  });
  const perComponent = perComponentStart < 0 ? '' : lines.slice(perComponentStart + 1).join('\n');

  return {
    alwaysOnTokens: peakTokensIn(alwaysOnLine),
    onInvokeTokens: peakTokensIn(perComponent),
  };
};

export const readPluginCosts = (
  input: PluginDetailsInput,
  run: ClaudeCliRunner = runClaudeCli,
): Promise<readonly PluginCostEstimate[]> => {
  const enabled = input.plugins.filter((plugin) => {
    return plugin.enabled;
  });

  return Promise.all(enabled.map(async (plugin) => {
    const result = await run(['plugin', 'details', plugin.id], { cwd: input.home ?? homedir() });

    if (!result.ok) {
      return {
        plugin: plugin.id,
        alwaysOnTokens: 0,
        onInvokeTokens: 0,
      };
    }

    return {
      plugin: plugin.id,
      ...parsePluginDetails(result.output),
    };
  }));
};

/**
 * A blended input-token price turns always-on context into dollars. The
 * project's own last session is the sharper number when it has one; an open or
 * free session leaves it at zero, and the pooled rate stands in.
 */
export const attributePluginCosts = (
  usage: ProjectUsage | undefined,
  estimates: readonly PluginCostEstimate[],
  blendedUsdPerToken = 0,
): readonly PluginCostAttribution[] => {
  const inputTokens = (usage?.inputTokens ?? 0) + (usage?.cacheReadTokens ?? 0);
  const costUsd = usage?.costUsd ?? 0;
  const costPerToken = inputTokens > 0 && costUsd > 0
    ? costUsd / inputTokens
    : blendedUsdPerToken;

  return estimates.map((estimate) => {
    return {
      ...estimate,
      estimatedCostUsd: estimate.alwaysOnTokens * costPerToken,
    };
  });
};
