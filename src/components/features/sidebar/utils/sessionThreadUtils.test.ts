import {
  describe,
  expect,
  test,
} from 'vitest';

import { buildSessionThreads } from './sessionThreadUtils';

import type { SessionSummary } from '@services/history/historyService';

const MINUTE = 60_000;
const START = Date.parse('2026-08-29T10:00:00Z');

const session = (
  id: string,
  startMs: number,
  endMs: number,
  overrides: Partial<SessionSummary> = {},
): SessionSummary => {
  return {
    agent: 'claude',
    actualSessionId: id,
    id,
    filePath: `/sessions/${id}.jsonl`,
    projectId: 'proj',
    cwd: '/repo/app',
    messageCount: 10,
    firstTimestampMs: startMs,
    lastTimestampMs: endMs,
    modifiedMs: endMs,
    sizeBytes: 100,
    ...overrides,
  };
};

const shapeOf = (sessions: readonly SessionSummary[]): readonly (readonly string[])[] => {
  return buildSessionThreads(sessions).map((thread) => {
    return thread.parts.map((part) => {
      return part.id;
    });
  });
};

describe('buildSessionThreads', () => {
  test('joins a session that picks up where the last one stopped', () => {
    expect(shapeOf([
      session('a', START, START + 30 * MINUTE),
      session('b', START + 31 * MINUTE, START + 60 * MINUTE),
    ])).toEqual([['a', 'b']]);
  });

  test('chains a run of resumed sessions into one thread', () => {
    expect(shapeOf([
      session('a', START, START + 10 * MINUTE),
      session('b', START + 11 * MINUTE, START + 20 * MINUTE),
      session('c', START + 21 * MINUTE, START + 30 * MINUTE),
    ])).toEqual([['a', 'b', 'c']]);
  });

  test('leaves apart work that merely happened later', () => {
    expect(shapeOf([
      session('a', START, START + 10 * MINUTE),
      session('b', START + 90 * MINUTE, START + 100 * MINUTE),
    ])).toEqual([['b'], ['a']]);
  });

  test('refuses to join sessions from different directories', () => {
    expect(shapeOf([
      session('a', START, START + 10 * MINUTE),
      session('b', START + 11 * MINUTE, START + 20 * MINUTE, { cwd: '/repo/other' }),
    ])).toEqual([['b'], ['a']]);
  });

  test('treats a missing directory as no evidence rather than agreement', () => {
    expect(shapeOf([
      session('a', START, START + 10 * MINUTE, { cwd: undefined }),
      session('b', START + 11 * MINUTE, START + 20 * MINUTE, { cwd: undefined }),
    ])).toEqual([['b'], ['a']]);

    expect(shapeOf([
      session('a', START, START + 10 * MINUTE),
      session('b', START + 11 * MINUTE, START + 20 * MINUTE, { cwd: undefined }),
    ])).toEqual([['b'], ['a']]);
  });

  test('refuses to join sessions from different agents or projects', () => {
    expect(shapeOf([
      session('a', START, START + 10 * MINUTE),
      session('b', START + 11 * MINUTE, START + 20 * MINUTE, { agent: 'codex' }),
    ])).toEqual([['b'], ['a']]);

    expect(shapeOf([
      session('a', START, START + 10 * MINUTE),
      session('b', START + 11 * MINUTE, START + 20 * MINUTE, { projectId: 'other' }),
    ])).toEqual([['b'], ['a']]);
  });

  test('refuses to join a session that started before the last one ended', () => {
    expect(shapeOf([
      session('a', START, START + 30 * MINUTE),
      session('b', START + 5 * MINUTE, START + 40 * MINUTE),
    ])).toEqual([['b'], ['a']]);
  });

  test('orders threads by their most recent part', () => {
    const threads = buildSessionThreads([
      session('old', START, START + 5 * MINUTE),
      session('recent', START + 200 * MINUTE, START + 210 * MINUTE),
    ]);

    expect(threads.map((thread) => {
      return thread.head.id;
    })).toEqual(['recent', 'old']);
  });

  test('totals the messages and the span of a joined thread', () => {
    const [thread] = buildSessionThreads([
      session('a', START, START + 10 * MINUTE, { messageCount: 12 }),
      session('b', START + 11 * MINUTE, START + 20 * MINUTE, { messageCount: 30 }),
    ]);

    expect(thread?.messageCount).toBe(42);
    expect(thread?.head.id).toBe('a');
    expect(thread?.firstTimestampMs).toBe(START);
    expect(thread?.lastTimestampMs).toBe(START + 20 * MINUTE);
    expect(thread?.key).toBe('/sessions/a.jsonl');
  });

  test('returns nothing for a project with no sessions', () => {
    expect(buildSessionThreads([])).toEqual([]);
  });
});
