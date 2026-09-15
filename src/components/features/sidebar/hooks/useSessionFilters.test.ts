import { act, renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';

import { useSessionFilters } from './useSessionFilters';

import type { SessionSummary } from '@services/history/historyService';

const session = (id: string, title: string, lastTimestampMs: number): SessionSummary => {
  return {
    agent: 'claude',
    actualSessionId: id,
    id,
    filePath: `/r/${id}.jsonl`,
    projectId: 'p',
    title,
    messageCount: 1,
    firstTimestampMs: 0,
    lastTimestampMs,
    modifiedMs: 0,
    sizeBytes: 1,
  };
};

const NOW = Date.UTC(2026, 0, 10);
const SESSIONS = [
  session('a', 'Deploy the api', NOW - 1000),
  session('b', 'Write tests', NOW - 30 * 24 * 60 * 60 * 1000),
];

test('narrows by text and by date, and reports whether the text box is in play', () => {
  const { result } = renderHook(() => {
    return useSessionFilters(SESSIONS, NOW);
  });

  expect(result.current.visibleSessions).toHaveLength(2);
  expect(result.current.filtering).toBe(false);

  act(() => {
    result.current.setText(' DEPLOY ');
  });

  expect(result.current.visibleSessions.map((item) => {
    return item.id;
  })).toEqual(['a']);
  expect(result.current.filtering).toBe(true);

  act(() => {
    result.current.setText('');
    result.current.setDateFilter('week');
  });

  expect(result.current.visibleSessions.map((item) => {
    return item.id;
  })).toEqual(['a']);
});
