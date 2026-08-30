import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  aggregateSession,
  cachedAggregate,
  createAccumulator,
  foldAggregate,
} from './aggregateUtils';

import type {
  AssistantTurnEntry,
  HistoryEntry,
  SessionSummary,
  TokenUsage,
} from '../../history/types';
import type { SessionAggregate } from './aggregateUtils';

const usage = (input: number, output: number, creation = 0, read = 0): TokenUsage => {
  return {
    inputTokens: input,
    outputTokens: output,
    cacheCreationTokens: creation,
    cacheReadTokens: read,
  };
};

const assistant = (overrides: Partial<AssistantTurnEntry> = {}): HistoryEntry => {
  return {
    kind: 'assistant',
    uuid: 'a1',
    timestamp: '2026-07-01T09:00:00.000Z',
    sidechain: false,
    model: 'claude-fable-5',
    usage: usage(10, 20),
    blocks: [],
    ...overrides,
  };
};

const user = (timestamp = '2026-07-01T09:00:00.000Z'): HistoryEntry => {
  return {
    kind: 'user',
    uuid: 'u1',
    timestamp,
    sidechain: false,
    meta: false,
    text: 'hello',
    outcomes: [],
  };
};

const toolBlock = (name: string): AssistantTurnEntry['blocks'][number] => {
  return {
    blockType: 'tool-use',
    call: {
      id: `t-${name}`,
      name,
      input: {
        kind: 'generic',
        title: name,
        rows: [],
      },
    },
  };
};

const session = (overrides: Partial<SessionSummary> = {}): SessionSummary => {
  return {
    agent: 'claude',
    actualSessionId: 's1',
    id: 's1',
    filePath: '/sessions/s1.jsonl',
    projectId: 'proj',
    messageCount: 2,
    firstTimestampMs: 1,
    lastTimestampMs: 2,
    modifiedMs: 2,
    sizeBytes: 100,
    ...overrides,
  };
};

describe('aggregateSession', () => {
  test('counts an assistant turn once across every total it feeds', () => {
    const aggregate = aggregateSession([assistant({
      usage: usage(10, 20, 30, 40),
      costUsd: 0.5,
      durationMs: 250,
      blocks: [toolBlock('Read'), toolBlock('Read'), toolBlock('Bash')],
    })], true);

    expect(aggregate.messages).toBe(1);
    expect(aggregate.usageRecorded).toBe(true);
    expect(aggregate.inputTokens).toBe(10);
    expect(aggregate.outputTokens).toBe(20);
    expect(aggregate.cacheCreationTokens).toBe(30);
    expect(aggregate.cacheReadTokens).toBe(40);
    expect(aggregate.conversationTokens).toBe(30);
    expect(aggregate.nonConversationTokens).toBe(70);
    expect(aggregate.billingTokens).toBe(100);
    expect(aggregate.durationMs).toBe(250);
    expect(aggregate.tools).toEqual({
      Bash: 1,
      Read: 2,
    });
    expect(aggregate.pricing).toEqual([{
      model: 'claude-fable-5',
      inputTokens: 80,
      outputTokens: 20,
      costUsd: 0.5,
    }]);
  });

  test('bills the whole turn as conversation when the split is unknown', () => {
    const aggregate = aggregateSession([assistant({ usage: usage(10, 20, 30, 40) })], false);

    expect(aggregate.conversationTokens).toBe(100);
    expect(aggregate.nonConversationTokens).toBe(0);
    expect(aggregate.splitUnavailable).toBe(true);
  });

  test('leaves the split flag alone when a turn reports no usage at all', () => {
    const aggregate = aggregateSession([assistant({ usage: undefined })], false);

    expect(aggregate.splitUnavailable).toBe(false);
    expect(aggregate.usageRecorded).toBe(false);
    expect(aggregate.pricing[0]?.inputTokens).toBe(0);
  });

  test('names an unreported model rather than dropping its tokens', () => {
    const aggregate = aggregateSession([assistant({ model: undefined })], true);

    expect(aggregate.pricing[0]?.model).toBe('unknown');
  });

  test('counts both sides of the conversation towards the day it happened on', () => {
    const aggregate = aggregateSession([
      user(),
      assistant({ usage: usage(1, 2) }),
      assistant({
        timestamp: '2026-07-02T09:00:00.000Z',
        usage: usage(3, 4),
      }),
    ], true);

    expect(aggregate.days).toEqual({
      '2026-07-01': {
        messages: 2,
        tokens: 3,
      },
      '2026-07-02': {
        messages: 1,
        tokens: 7,
      },
    });
  });

  test('ignores turns without a usable date and entries that are not turns', () => {
    const aggregate = aggregateSession([
      user('nope'),
      {
        kind: 'summary',
        text: 'done',
      },
      {
        kind: 'system',
        uuid: 'sys',
        timestamp: '2026-07-01T09:00:00.000Z',
        sidechain: false,
        text: 'note',
      },
    ], true);

    expect(aggregate.days).toEqual({});
    expect(aggregate.messages).toBe(0);
  });
});

describe('foldAggregate', () => {
  test('adds one session into a running report', () => {
    const accumulator = createAccumulator();
    const aggregate = aggregateSession([
      user(),
      assistant({
        usage: usage(10, 20, 30, 40),
        durationMs: 5,
        blocks: [toolBlock('Read')],
      }),
    ], true);

    foldAggregate(accumulator, aggregate, session({ title: 'Named' }));
    foldAggregate(accumulator, aggregate, session({
      filePath: '/sessions/s2.jsonl',
      id: 's2',
      summary: 'Summarised',
    }));

    expect(accumulator.sessions).toBe(2);
    expect(accumulator.messages).toBe(2);
    expect(accumulator.billingTokens).toBe(200);
    expect(accumulator.durationMs).toBe(10);
    expect(accumulator.usageRecorded).toBe(true);
    expect(accumulator.tools.get('Read')).toBe(2);
    expect(accumulator.days.get('2026-07-01')).toEqual({
      date: '2026-07-01',
      messages: 4,
      tokens: 200,
    });
    expect(accumulator.pricingEntries).toHaveLength(2);
    expect(accumulator.perSession.map((entry) => {
      return entry.title;
    })).toEqual(['Named', 'Summarised']);
  });

  test('falls back to the preview when a session has no better name', () => {
    const accumulator = createAccumulator();

    foldAggregate(accumulator, aggregateSession([], true), session({ preview: 'First line' }));

    expect(accumulator.perSession[0]?.title).toBe('First line');
  });

  test('carries the unavailable split through to the report', () => {
    const accumulator = createAccumulator();

    foldAggregate(
      accumulator,
      aggregateSession([assistant({ usage: usage(1, 1) })], false),
      session(),
    );

    expect(accumulator.splitUnavailable).toBe(true);
  });
});

const counter = (): { readonly calls: () => number;
  readonly compute: () => Promise<SessionAggregate>; } => {
  let computed = 0;

  return {
    calls: () => {
      return computed;
    },
    compute: async () => {
      computed += 1;

      return Promise.resolve(aggregateSession([assistant()], true));
    },
  };
};

describe('cachedAggregate', () => {
  test('reuses the counters of a transcript that has not changed', async () => {
    const { calls, compute } = counter();
    const unchanged = session({ filePath: '/cache/a.jsonl' });

    await cachedAggregate(unchanged, compute);
    await cachedAggregate(unchanged, compute);

    expect(calls()).toBe(1);
  });

  test('re-reads a transcript once it has grown', async () => {
    const { calls, compute } = counter();

    await cachedAggregate(session({ filePath: '/cache/b.jsonl' }), compute);
    await cachedAggregate(session({
      filePath: '/cache/b.jsonl',
      modifiedMs: 999,
      sizeBytes: 4_000,
      messageCount: 12,
    }), compute);

    expect(calls()).toBe(2);
  });
});
