import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { exportSessions } from './bulkExportUtils';

import type { SessionSummary } from '@services/history/historyService';

const NOW = Date.parse('2026-08-29T12:00:00Z');

afterEach(() => {
  vi.unstubAllGlobals();
});

const session = (id: string, title?: string): SessionSummary => {
  return {
    agent: 'claude',
    actualSessionId: id,
    id,
    filePath: `/sessions/${id}.jsonl`,
    projectId: 'p',
    title,
    messageCount: 1,
    firstTimestampMs: NOW,
    lastTimestampMs: NOW,
    modifiedMs: NOW,
    sizeBytes: 10,
  };
};

const page = (text: string, hasMore: boolean, nextOffset: number): object => {
  return {
    entries: [{
      kind: 'user',
      uuid: text,
      timestamp: '2026-08-29T10:00:00Z',
      sidechain: false,
      meta: false,
      text,
      outcomes: [],
    }],
    total: 1,
    messageCount: 1,
    hasMore,
    nextOffset,
  };
};

describe('exportSessions', () => {
  test('writes one document per session, separated', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return Response.json(page('the question', false, 1));
    }));

    const result = await exportSessions([session('a', 'First'), session('b', 'Second')], 'webapp', NOW);

    expect(result.failed).toBe(0);
    expect(result.markdown).toContain('First');
    expect(result.markdown).toContain('Second');
    expect(result.markdown).toContain('---');
  });

  test('walks every page of a long transcript', async () => {
    let calls = 0;

    vi.stubGlobal('fetch', vi.fn(() => {
      calls += 1;

      return Response.json(page(`chunk ${String(calls)}`, calls < 3, calls));
    }));

    const result = await exportSessions([session('a')], 'webapp', NOW);

    expect(calls).toBe(3);
    expect(result.markdown).toContain('chunk 1');
    expect(result.markdown).toContain('chunk 3');
  });

  test('stops walking a session that never reports an end', async () => {
    let calls = 0;

    vi.stubGlobal('fetch', vi.fn(() => {
      calls += 1;

      return Response.json(page('endless', true, calls));
    }));

    await exportSessions([session('a')], 'webapp', NOW);

    expect(calls).toBe(20);
  });

  test('counts a session it could not read rather than losing the rest', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      return url.endsWith('/messages')
        ? new Response('{"error":"gone"}', { status: 500 })
        : Response.json(page('q', false, 1));
    }));

    const result = await exportSessions([session('a')], 'webapp', NOW);

    expect(result.failed).toBe(1);
    expect(result.markdown).toBe('');
  });

  test('falls back through the titles a session might carry', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return Response.json(page('q', false, 1));
    }));

    const bare = {
      ...session('fallback-id'),
      title: undefined,
      summary: undefined,
      preview: undefined,
    };
    const result = await exportSessions([bare], 'webapp', NOW);

    expect(result.markdown).toContain('fallback-id');
  });

  test('produces nothing for an empty selection', async () => {
    expect(await exportSessions([], 'webapp', NOW)).toEqual({
      markdown: '',
      failed: 0,
    });
  });
});
