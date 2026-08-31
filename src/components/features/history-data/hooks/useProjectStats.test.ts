import {
  act,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { useProjectStats } from './useProjectStats';

import type { ProjectSummary } from '@services/history/historyService';
import type { ProjectStats } from '@services/stats/statsService';

const PROJECT: ProjectSummary = {
  agent: 'claude',
  id: 'p',
  name: 'Project',
  sessionCount: 1,
  messageCount: 2,
  lastActivityMs: 1,
};

const stats: ProjectStats = {
  projectId: 'p',
  totals: {
    usageRecorded: true,
    sessions: 1,
    messages: 2,
    inputTokens: 3,
    outputTokens: 4,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    costUsd: 0,
    durationMs: 0,
  },
  models: [],
  tools: [],
  activity: [],
  topSessions: [],
  rhythm: {
    hours: [],
    weekdays: [],
    activeDays: 0,
    spanDays: 0,
    currentStreak: 0,
    longestStreak: 0,
  },
  effort: {
    userMessages: 0,
    userChars: 0,
    userWords: 0,
    codeEdits: 0,
    commandsRun: 0,
    searches: 0,
    webActions: 0,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useProjectStats', () => {
  test('skips fetching without a project', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => {
      return useProjectStats(null);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('loads and reloads stats for a project', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response(JSON.stringify({ stats }));
    }));

    const { result } = renderHook(() => {
      return useProjectStats(PROJECT);
    });

    await waitFor(() => {
      expect(result.current.data?.totals.messages).toBe(2);
    });
  });
});

describe('useProjectStats reload and errors', () => {
  test('reports failures and supports reload', async () => {
    const fetchMock = vi.fn((): Promise<Response> => {
      return Promise.resolve(new Response('{"error":"stats down"}', { status: 500 }));
    });

    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => {
      return useProjectStats(PROJECT);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('stats down');
    });

    fetchMock.mockImplementation((): Promise<Response> => {
      return Promise.resolve(new Response(JSON.stringify({ stats })));
    });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
  });
});

describe('useProjectStats unmount safety', () => {
  test('ignores resolutions after unmount', () => {
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        });
      }),
    );

    const { result, unmount } = renderHook(() => {
      return useProjectStats(PROJECT);
    });

    expect(result.current.data).toBeUndefined();

    unmount();
    resolveFetch(Response.json(JSON.parse('{"stats":null}')));

    expect(result.current.data).toBeUndefined();
  });
});
