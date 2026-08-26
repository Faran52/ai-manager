import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  conversationMessageCount,
  firstUserMessageText,
  pairToolOutcomes,
} from './outcomeUtils';

import type {
  AssistantTurnEntry,
  HistoryEntry,
  ToolOutcome,
} from '@services/history/historyService';

const outcome = (toolUseId: string): ToolOutcome => {
  return {
    toolUseId,
    status: 'ok',
    images: [],
  };
};

const userWith = (...ids: readonly string[]): HistoryEntry => {
  return {
    kind: 'user',
    uuid: `u-${ids.join()}`,
    timestamp: 't',
    sidechain: false,
    meta: false,
    text: '',
    outcomes: ids.map(outcome),
  };
};

const assistantWith = (...ids: readonly string[]): AssistantTurnEntry => {
  return {
    kind: 'assistant',
    uuid: `a-${ids.join()}`,
    timestamp: 't',
    sidechain: false,
    blocks: ids.map((id) => {
      return {
        blockType: 'tool-use',
        call: {
          id,
          name: 'tool',
          input: {
            kind: 'generic',
            title: 'tool',
            rows: [],
          },
        },
      };
    }),
  };
};

describe('pairToolOutcomes', () => {
  test('indexes outcomes only when a matching tool call exists', () => {
    const entries = [assistantWith('tu1'), userWith('tu1', 'missing', '')];
    const pairs = pairToolOutcomes(entries);

    expect(pairs.get('tu1')).toEqual({
      toolUseId: 'tu1',
      status: 'ok',
      images: [],
    });
    expect(pairs.has('missing')).toBe(false);
    expect(pairs.has('')).toBe(false);
  });
});

describe('conversation semantics', () => {
  test('normalizes counts across source-specific tool envelope shapes', () => {
    const user: HistoryEntry = {
      kind: 'user',
      uuid: 'question',
      timestamp: 't1',
      sidechain: false,
      meta: false,
      text: 'Question',
      outcomes: [],
    };
    const answer: AssistantTurnEntry = {
      kind: 'assistant',
      uuid: 'answer',
      timestamp: 't4',
      sidechain: false,
      blocks: [{
        blockType: 'text',
        text: 'Answer',
      }],
    };
    const splitTools = [user, assistantWith('call'), userWith('call'), answer];
    const combinedTools: HistoryEntry[] = [
      user,
      {
        ...answer,
        uuid: 'combined',
        blocks: [
          ...answer.blocks,
          ...assistantWith('call').blocks,
        ],
      },
      userWith('call'),
    ];
    const plain = [user, answer];

    expect([splitTools, combinedTools, plain].map(conversationMessageCount)).toEqual([2, 2, 2]);
    expect([splitTools, combinedTools, plain].map(firstUserMessageText)).toEqual([
      'Question',
      'Question',
      'Question',
    ]);
  });
});
