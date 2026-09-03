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
  test('joins the transcripts that recorded one rewound conversation', () => {
    expect(shapeOf([
      session('full', START, START + 30 * MINUTE, {
        rootUuid: 'root-1',
        messageCount: 40,
      }),
      session('rewound', START, START + 10 * MINUTE, {
        rootUuid: 'root-1',
        messageCount: 12,
      }),
    ])).toEqual([['full', 'rewound']]);
  });

  test('leaves apart work that merely followed on the clock', () => {
    expect(shapeOf([
      session('a', START, START + 10 * MINUTE, { rootUuid: 'root-1' }),
      session('b', START + 11 * MINUTE, START + 20 * MINUTE, { rootUuid: 'root-2' }),
    ])).toEqual([['b'], ['a']]);
  });

  test('stands a transcript that records no root on its own', () => {
    expect(shapeOf([
      session('a', START, START + 10 * MINUTE),
      session('b', START + 11 * MINUTE, START + 20 * MINUTE),
    ])).toEqual([['b'], ['a']]);
  });

  test('refuses to join transcripts that different agents rooted alike', () => {
    expect(shapeOf([
      session('a', START, START + 10 * MINUTE, { rootUuid: 'root-1' }),
      session('b', START + 11 * MINUTE, START + 20 * MINUTE, {
        rootUuid: 'root-1',
        agent: 'codex',
      }),
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

  test('counts the fullest part rather than the sum, and spans them all', () => {
    const [thread] = buildSessionThreads([
      session('rewound', START, START + 10 * MINUTE, {
        rootUuid: 'root-1',
        messageCount: 12,
      }),
      session('full', START, START + 20 * MINUTE, {
        rootUuid: 'root-1',
        messageCount: 30,
      }),
    ]);

    expect(thread?.messageCount).toBe(30);
    expect(thread?.head.id).toBe('full');
    expect(thread?.firstTimestampMs).toBe(START);
    expect(thread?.lastTimestampMs).toBe(START + 20 * MINUTE);
    expect(thread?.key).toBe('claude:root-1');
  });

  test('returns nothing for a project with no sessions', () => {
    expect(buildSessionThreads([])).toEqual([]);
  });
});
