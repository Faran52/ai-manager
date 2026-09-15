import { expect, test } from 'vitest';

import { previewOf } from './navigatorUtils';

import type { HistoryEntry } from '@services/history/historyService';

const user = (overrides: Partial<Extract<HistoryEntry, { kind: 'user' }>>): HistoryEntry => {
  return {
    kind: 'user',
    uuid: 'u',
    timestamp: '2026-05-05T10:00:00Z',
    sidechain: false,
    meta: false,
    text: '',
    outcomes: [],
    ...overrides,
  };
};

test('previews a user turn by its text, then its command, then its injected context', () => {
  expect(previewOf(user({ text: '  the   question  ' }))).toBe('the question');
  expect(previewOf(user({ command: '/review' }))).toBe('/review');
  expect(previewOf(user({ injectedText: 'injected context' }))).toBe('injected context');
  expect(previewOf(user({}))).toBe('');
});

test('previews an assistant turn by its first text or the tool it called', () => {
  expect(previewOf({
    kind: 'assistant',
    uuid: 'a1',
    timestamp: 't',
    sidechain: false,
    blocks: [{
      blockType: 'text',
      text: 'the  answer',
    }],
  })).toBe('the answer');
  expect(previewOf({
    kind: 'assistant',
    uuid: 'a2',
    timestamp: 't',
    sidechain: false,
    blocks: [{
      blockType: 'tool-use',
      call: {
        id: 't1',
        name: 'Bash',
        input: {
          kind: 'bash',
          command: 'ls',
        },
      },
    }],
  })).toBe('Bash');
  expect(previewOf({
    kind: 'assistant',
    uuid: 'a3',
    timestamp: 't',
    sidechain: false,
    blocks: [{ blockType: 'redacted' }],
  })).toBe('');
});

test('previews system notices and summaries by their text', () => {
  expect(previewOf({
    kind: 'system',
    uuid: 's',
    timestamp: 't',
    sidechain: false,
    text: 'hook\nran',
  })).toBe('hook ran');
  expect(previewOf({
    kind: 'summary',
    text: 'the recap',
  })).toBe('the recap');
});
