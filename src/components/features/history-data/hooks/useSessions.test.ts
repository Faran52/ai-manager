import { renderHook, waitFor } from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { useSessions } from './useSessions';

import type { ProjectSummary, SessionSummary } from '@services/history/historyService';

const PROJECT: ProjectSummary = {
  agent: 'claude',
  id: 'proj',
  name: 'Project',
  sessionCount: 1,
  messageCount: 3,
  lastActivityMs: 5,
};

const session = (): SessionSummary => {
  return {
    agent: 'claude',
    actualSessionId: 's',
    id: 's',
    filePath: '/f.jsonl',
    projectId: 'p',
    messageCount: 3,
    firstTimestampMs: 0,
    lastTimestampMs: 5,
    modifiedMs: 5,
    sizeBytes: 10,
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSessions', () => {
  test('resolves an empty list without fetching when no project is selected', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => {
      return useSessions(null);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('fetches sessions for the selected project', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response(JSON.stringify({ sessions: [session()] }));
    }));

    const { result } = renderHook(() => {
      return useSessions(PROJECT);
    });

    await waitFor(() => {
      expect(result.current.data?.at(0)?.filePath).toBe('/f.jsonl');
    });
  });

  test('reports failures through the error field', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"bad project"}', { status: 400 });
    }));

    const { result } = renderHook(() => {
      return useSessions(PROJECT);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('bad project');
    });
  });
});

describe('useSessions reload', () => {
  test('refetches on demand', async () => {
    const fetchMock = vi.fn(() => {
      return new Response(JSON.stringify({ sessions: [session()] }));
    });

    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => {
      return useSessions(PROJECT);
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    result.current.reload();

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('useSessions unmount safety', () => {
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
      return useSessions(PROJECT);
    });

    expect(result.current.data).toBeUndefined();

    unmount();
    resolveFetch(Response.json({ sessions: [] }));

    expect(result.current.data).toBeUndefined();
  });
});

describe('useSessions live polling', () => {
  test('reloads on an interval and on becoming visible, only while visible', async () => {
    const fetchMock = vi.fn(() => {
      return new Response(JSON.stringify({ sessions: [session()] }));
    });

    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result, unmount } = renderHook(() => {
      return useSessions(PROJECT, true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    const afterFirstLoad = fetchMock.mock.calls.length;

    await vi.advanceTimersByTimeAsync(3_000);
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(afterFirstLoad);
    });

    const afterTick = fetchMock.mock.calls.length;

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await vi.advanceTimersByTimeAsync(3_000);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(fetchMock.mock.calls).toHaveLength(afterTick);

    unmount();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('does not poll when live watching is off', async () => {
    const fetchMock = vi.fn(() => {
      return new Response(JSON.stringify({ sessions: [session()] }));
    });

    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => {
      return useSessions(PROJECT);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    const afterFirstLoad = fetchMock.mock.calls.length;

    await vi.advanceTimersByTimeAsync(9_000);

    expect(fetchMock.mock.calls).toHaveLength(afterFirstLoad);
    vi.useRealTimers();
  });
});
