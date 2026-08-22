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

// Running totals flushed at session end, so an open session is not counted yet.
const projectEntry = async (projectPath: string, home: string): Promise<JsonObject | undefined> => {
  try {
    const parsed = parseJsonContainer(await readFile(join(home, '.claude.json'), 'utf8'));
    const projects = isJsonObject(parsed) ? parsed.projects : undefined;
    const entry = isJsonObject(projects) ? projects[projectPath] : undefined;

    return isJsonObject(entry) ? entry : undefined;
  }
  catch {
    return undefined;
  }
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
