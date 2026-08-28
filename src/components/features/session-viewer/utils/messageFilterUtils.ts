import { pairToolOutcomes } from '@services/history/historyService';

import type {
  AssistantBlock,
  HistoryEntry,
  ToolOutcome,
} from '@services/history/historyService';

export interface MessageRoleFilters {
  readonly human: boolean;
  readonly ai: boolean;
}

export interface MessageContentFilters {
  readonly text: boolean;
  readonly thinking: boolean;
  readonly tools: boolean;
  readonly commands: boolean;
}

export interface MessageFilters {
  readonly roles: MessageRoleFilters;
  readonly content: MessageContentFilters;
}

export type MessageFilterKey = keyof MessageRoleFilters | keyof MessageContentFilters;

const FILTER_COUNT = 6;

export const defaultMessageFilters = (): MessageFilters => {
  return {
    roles: {
      human: true,
      ai: true,
    },
    content: {
      text: true,
      thinking: true,
      tools: true,
      commands: true,
    },
  };
};

export const encodeMessageFilters = (filters: MessageFilters): string => {
  return [
    filters.roles.human,
    filters.roles.ai,
    filters.content.text,
    filters.content.thinking,
    filters.content.tools,
    filters.content.commands,
  ].map((enabled) => {
    return enabled ? '1' : '0';
  }).join('');
};

export const decodeMessageFilters = (value: string | null): MessageFilters => {
  if (value?.length !== FILTER_COUNT || /[^01]/u.test(value)) {
    return defaultMessageFilters();
  }

  return {
    roles: {
      human: value.startsWith('1'),
      ai: value[1] === '1',
    },
    content: {
      text: value[2] === '1',
      thinking: value[3] === '1',
      tools: value[4] === '1',
      commands: value[5] === '1',
    },
  };
};

export const hasActiveMessageFilters = (filters: MessageFilters): boolean => {
  return Object.values(filters.roles).includes(false) || Object.values(filters.content).includes(false);
};

export const blockIsVisible = (block: AssistantBlock, filters: MessageFilters): boolean => {
  switch (block.blockType) {
    case 'text':
      return filters.content.text;
    case 'thinking':
    case 'redacted':
      return filters.content.thinking;
    case 'tool-use':
      return filters.content.tools;
  }
};

export const entryIsVisible = (
  entry: HistoryEntry,
  filters: MessageFilters,
  pairs?: ReadonlyMap<string, ToolOutcome>,
): boolean => {
  switch (entry.kind) {
    case 'user': {
      const pairedOutcomeOnly = pairs != null
        && entry.text.length === 0
        && entry.injectedText == null
        && entry.command == null
        && entry.outcomes.length > 0
        && entry.outcomes.every((outcome) => {
          return pairs.has(outcome.toolUseId);
        });

      if (pairedOutcomeOnly) {
        return false;
      }

      return filters.roles.human && (
        (filters.content.text && entry.text.length > 0)
        || (filters.content.text && entry.injectedText != null)
        || (filters.content.commands && entry.command != null)
        || (filters.content.tools && entry.outcomes.length > 0)
      );
    }
    case 'assistant':
      return filters.roles.ai && entry.blocks.some((block) => {
        return blockIsVisible(block, filters);
      });
    case 'system':
    case 'summary':
      return filters.content.text;
  }
};

export const countVisibleEntries = (entries: readonly HistoryEntry[], filters: MessageFilters): number => {
  const pairs = pairToolOutcomes(entries);

  return entries.filter((entry) => {
    return entryIsVisible(entry, filters, pairs);
  }).length;
};

export const toggleMessageFilter = (filters: MessageFilters, key: MessageFilterKey): MessageFilters => {
  if (key === 'human' || key === 'ai') {
    return {
      ...filters,
      roles: {
        ...filters.roles,
        [key]: !filters.roles[key],
      },
    };
  }

  return {
    ...filters,
    content: {
      ...filters.content,
      [key]: !filters.content[key],
    },
  };
};
