import type { HistoryEntry, ToolOutcome } from '@services/history/historyService';

export const pairToolOutcomes = (entries: readonly HistoryEntry[]): ReadonlyMap<string, ToolOutcome> => {
  const pairs = new Map<string, ToolOutcome>();

  for (const entry of entries) {
    if (entry.kind !== 'user') {
      continue;
    }

    for (const outcome of entry.outcomes) {
      if (outcome.toolUseId.length > 0) {
        pairs.set(outcome.toolUseId, outcome);
      }
    }
  }

  return pairs;
};
