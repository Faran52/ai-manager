import {
  blockIsVisible,
  countVisibleEntries,
  defaultMessageFilters,
  entryIsVisible,
  hasActiveMessageFilters,
  toggleMessageFilter,
} from './messageFilters';

import type { HistoryEntry } from '@services/history/historyService';

const entries: readonly HistoryEntry[] = [
  {
    kind: 'user',
    uuid: 'u1',
    timestamp: 't1',
    sidechain: false,
    meta: false,
    text: 'question',
    outcomes: [],
  },
  {
    kind: 'user',
    uuid: 'u2',
    timestamp: 't2',
    sidechain: false,
    meta: false,
    text: '',
    command: '/review',
    outcomes: [],
  },
  {
    kind: 'user',
    uuid: 'u3',
    timestamp: 't3',
    sidechain: false,
    meta: false,
    text: '',
    outcomes: [{
      toolUseId: 'tool',
      status: 'ok',
      images: [],
    }],
  },
  {
    kind: 'assistant',
    uuid: 'a1',
    timestamp: 't4',
    sidechain: false,
    blocks: [
      {
        blockType: 'text',
        text: 'answer',
      },
      {
        blockType: 'thinking',
        thinking: 'reason',
      },
      { blockType: 'redacted' },
      {
        blockType: 'tool-use',
        call: {
          id: 'tool',
          name: 'Read',
          input: {
            kind: 'generic',
            title: 'Read',
            rows: [],
          },
        },
      },
    ],
  },
  {
    kind: 'system',
    uuid: 's1',
    timestamp: 't5',
    sidechain: false,
    text: 'notice',
  },
  {
    kind: 'summary',
    text: 'summary',
  },
];

describe('message filters', () => {
  test('covers every role and content category', () => {
    const defaults = defaultMessageFilters();
    const userText = entries.at(0);
    const userCommand = entries.at(1);
    const userTool = entries.at(2);
    const assistant = entries.at(3);

    if (userText == null || userCommand == null || userTool == null || assistant == null) {
      throw new Error('filter fixtures missing');
    }

    expect(countVisibleEntries(entries, defaults)).toBe(6);
    expect(assistant.kind === 'assistant' && assistant.blocks.every((block) => {
      return blockIsVisible(block, defaults);
    })).toBe(true);

    const noHuman = toggleMessageFilter(defaults, 'human');
    const noAi = toggleMessageFilter(defaults, 'ai');
    const noText = toggleMessageFilter(defaults, 'text');
    const noThinking = toggleMessageFilter(defaults, 'thinking');
    const noTools = toggleMessageFilter(defaults, 'tools');
    const noCommands = toggleMessageFilter(defaults, 'commands');

    expect(hasActiveMessageFilters(defaults)).toBe(false);
    expect(hasActiveMessageFilters(noHuman)).toBe(true);
    expect(countVisibleEntries(entries, noHuman)).toBe(3);
    expect(entryIsVisible(assistant, noAi)).toBe(false);
    expect(entryIsVisible(userText, noText)).toBe(false);
    expect(entryIsVisible(userCommand, noCommands)).toBe(false);
    expect(entryIsVisible(userTool, noTools)).toBe(false);
    expect(assistant.kind === 'assistant' && assistant.blocks.map((block) => {
      return blockIsVisible(block, noThinking);
    })).toEqual([true, false, false, true]);
  });
});
