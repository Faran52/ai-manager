import type { HistoryEntry, ToolOutcome } from '@services/history/historyService';

export const pairToolOutcomes = (entries: readonly HistoryEntry[]): ReadonlyMap<string, ToolOutcome> => {
  const callIds = new Set(entries.flatMap((entry) => {
    return entry.kind === 'assistant'
      ? entry.blocks.flatMap((block) => {
          return block.blockType === 'tool-use' && block.call.id.length > 0 ? [block.call.id] : [];
        })
      : [];
  }));
  const pairs = new Map<string, ToolOutcome>();

  for (const entry of entries) {
    if (entry.kind !== 'user') {
      continue;
    }

    for (const outcome of entry.outcomes) {
      if (callIds.has(outcome.toolUseId)) {
        pairs.set(outcome.toolUseId, outcome);
      }
    }
  }

  return pairs;
};

export const isConversationMessage = (entry: HistoryEntry): boolean => {
  if (entry.kind === 'user') {
    return !entry.meta && (entry.text.trim().length > 0 || entry.command != null);
  }

  return entry.kind === 'assistant' && entry.blocks.some((block) => {
    return block.blockType === 'text' && block.text.trim().length > 0;
  });
};

export const conversationMessageCount = (entries: readonly HistoryEntry[]): number => {
  return entries.filter(isConversationMessage).length;
};

export const firstUserMessageText = (entries: readonly HistoryEntry[]): string | undefined => {
  const entry = entries.find((candidate) => {
    return candidate.kind === 'user' && isConversationMessage(candidate);
  });

  return entry?.kind === 'user' ? entry.text : undefined;
};
