import { expect, test } from 'vitest';

import { previewOf, titleOf } from './sessionRowUtils';

import type { SessionSummary } from '@services/history/historyService';

const session = (overrides: Partial<SessionSummary>): SessionSummary => {
  return {
    agent: 'claude',
    actualSessionId: 'id',
    id: 'id',
    filePath: '/r/id.jsonl',
    projectId: 'p',
    messageCount: 1,
    firstTimestampMs: 0,
    lastTimestampMs: 0,
    modifiedMs: 0,
    sizeBytes: 1,
    ...overrides,
  };
};

test('names a session by title, then summary, then preview, then id', () => {
  expect(titleOf(session({ title: 'Fix login' }))).toBe('Fix login');
  expect(titleOf(session({ summary: 'summarised' }))).toBe('summarised');
  expect(titleOf(session({ preview: 'first words' }))).toBe('first words');
  expect(titleOf(session({}))).toBe('id');
});

test('shows a preview line only when it says something the title does not', () => {
  expect(previewOf(session({
    title: 'Fix login',
    preview: 'please fix login',
  }))).toBe('please fix login');
  expect(previewOf(session({ preview: 'first words' }))).toBeNull();
  expect(previewOf(session({}))).toBeNull();
});
