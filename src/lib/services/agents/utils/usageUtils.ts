import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { isJsonObject, parseJsonContainer } from '@utils/jsonUtils';

import type { JsonObject } from '@utils/jsonUtils';

export interface ModelUsage {
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheCreationTokens: number;
  readonly costUsd: number;
}

export interface ModelCost {
  readonly costUsd: number;
  readonly billedTokens: number;
}

export interface ProjectTrust {
  readonly trusted: boolean;
  readonly onboarded: boolean;
  readonly known: boolean;
}

export interface ProjectUsage {
  readonly costUsd: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly durationMs: number;
  readonly lastActiveMs: number;
  readonly models: readonly ModelUsage[];
}

const numberAt = (record: JsonObject, key: string): number => {
  const value = record[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const modelsFrom = (entry: JsonObject): readonly ModelUsage[] => {
  const usage = entry.lastModelUsage;

  if (!isJsonObject(usage)) {
    return [];
  }

  return Object.entries(usage).flatMap(([model, value]) => {
    if (!isJsonObject(value)) {
      return [];
    }

    return [{
      model,
      inputTokens: numberAt(value, 'inputTokens'),
      outputTokens: numberAt(value, 'outputTokens'),
      cacheReadTokens: numberAt(value, 'cacheReadInputTokens'),
      cacheCreationTokens: numberAt(value, 'cacheCreationInputTokens'),
      costUsd: numberAt(value, 'costUSD'),
    }];
  }).sort((left, right) => {
    return right.costUsd - left.costUsd;
  });
};

const projects = async (home: string): Promise<JsonObject | undefined> => {
  try {
    const parsed = parseJsonContainer(await readFile(join(home, '.claude.json'), 'utf8'));
    const known = isJsonObject(parsed) ? parsed.projects : undefined;

    return isJsonObject(known) ? known : undefined;
  }
  catch {
    return undefined;
  }
};

// Running totals flushed at session end, so an open session is not counted yet.
const projectEntry = async (projectPath: string, home: string): Promise<JsonObject | undefined> => {
  const entry = (await projects(home))?.[projectPath];

  return isJsonObject(entry) ? entry : undefined;
};

/**
 * What Claude Code itself billed, per model, summed over every project it has
 * seen. Only the ratio is wanted: `lastModelUsage` holds one session's running
 * totals per project, so these are a sample of the history rather than all of
 * it, and a cost per token divides that scale back out. Model keys arrive as
 * Claude Code writes them, context tier included (`claude-opus-5[1m]`).
 */
export const readModelCosts = async (
  home = homedir(),
): Promise<ReadonlyMap<string, ModelCost>> => {
  const costs = new Map<string, ModelCost>();

  for (const entry of Object.values((await projects(home)) ?? {})) {
    if (!isJsonObject(entry)) {
      continue;
    }

    for (const model of modelsFrom(entry)) {
      const running = costs.get(model.model);

      costs.set(model.model, {
        costUsd: (running?.costUsd ?? 0) + model.costUsd,
        billedTokens: (running?.billedTokens ?? 0)
          + model.inputTokens
          + model.outputTokens
          + model.cacheReadTokens
          + model.cacheCreationTokens,
      });
    }
  }

  return costs;
};

/**
 * One price per token across everything Claude Code has billed. A single
 * project's `lastCost` is zero whenever its most recent session is still open,
 * so a per-project rate drops to zero exactly when someone is using the app;
 * pooling every project keeps a rate on hand.
 */
export const readBlendedRate = async (home = homedir()): Promise<number> => {
  let costUsd = 0;
  let billedTokens = 0;

  for (const cost of (await readModelCosts(home)).values()) {
    costUsd += cost.costUsd;
    billedTokens += cost.billedTokens;
  }

  return billedTokens === 0 ? 0 : costUsd / billedTokens;
};

// Whether Claude Code has seen this project, and whether it was ever trusted.
export const readProjectTrust = async (
  projectPath: string,
  home = homedir(),
): Promise<ProjectTrust> => {
  const entry = await projectEntry(projectPath, home);

  return {
    known: entry != null,
    trusted: entry?.hasTrustDialogAccepted === true,
    onboarded: entry?.hasCompletedProjectOnboarding === true,
  };
};

export const readProjectUsage = async (
  projectPath: string,
  home = homedir(),
): Promise<ProjectUsage | undefined> => {
  const entry = await projectEntry(projectPath, home);

  if (entry == null) {
    return undefined;
  }

  const usage: ProjectUsage = {
    costUsd: numberAt(entry, 'lastCost'),
    inputTokens: numberAt(entry, 'lastTotalInputTokens'),
    outputTokens: numberAt(entry, 'lastTotalOutputTokens'),
    cacheReadTokens: numberAt(entry, 'lastTotalCacheReadInputTokens'),
    durationMs: numberAt(entry, 'lastDuration'),
    lastActiveMs: numberAt(entry, 'lastStartTime'),
    models: modelsFrom(entry),
  };

  return usage.costUsd === 0 && usage.models.length === 0 ? undefined : usage;
};
