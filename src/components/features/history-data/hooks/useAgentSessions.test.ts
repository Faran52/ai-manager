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

import { useAgentSessions } from './useAgentSessions';

import type { ProjectSummary, SessionSummary } from '@services/history/historyService';

const project = (id: string): ProjectSummary => {
  return {
    agent: 'claude',
    id,
    name: id,
    sessionCount: 1,
    messageCount: 3,
    lastActivityMs: 5,
  };
};

const PROJECTS: readonly ProjectSummary[] = [
  project('a'),
  project('b'),
  {
    ...project('c'),
    agent: 'codex',
  },
];

const session = (projectId: string, filePath: string): SessionSummary => {
  return {
    agent: 'claude',
    actualSessionId: filePath,
    id: filePath,
    filePath,
    projectId,
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

describe('useAgentSessions', () => {
  test('resolves an empty list without fetching when no agent is picked', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => {
      return useAgentSessions(null, undefined, PROJECTS);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('fans out over every project the agent owns and merges the sessions', async () => {
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
      const projectId = (body as { projectId: string }).projectId;

      return new Response(JSON.stringify({ sessions: [session(projectId, `/${projectId}.jsonl`)] }));
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useAgentSessions('claude', undefined, PROJECTS);
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    expect(result.current.data?.map((entry) => {
      return entry.projectId;
    }).sort()).toEqual(['a', 'b']);
    // The third project is codex, not this agent, so it never gets a request.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('narrows both the project list and the fetched sessions to one profile', async () => {
    const projects: readonly ProjectSummary[] = [
      ...PROJECTS,
      {
        ...project('d'),
        profile: 'Personal',
      },
    ];
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
      const projectId = (body as { projectId: string }).projectId;
      // The route fans out across every root sharing this project id, so a
      // caller scoped to one profile can still get another profile's session
      // back in the same response; the hook has to filter it out itself.
      const sessions = projectId === 'd'
        ? [
            {
              ...session('d', '/d.jsonl'),
              profile: 'Personal',
            },
            {
              ...session('d', '/d-default.jsonl'),
              profile: undefined,
            },
          ]
        : [session(projectId, `/${projectId}.jsonl`)];

      return new Response(JSON.stringify({ sessions }));
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useAgentSessions('claude', 'Personal', projects);
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    expect(result.current.data?.[0]?.filePath).toBe('/d.jsonl');
    // Only the Personal project (id "d") is fetched, not the default
    // profile's "a"/"b".
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('reports failures through the error field', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"bad agent"}', { status: 400 });
    }));

    const { result } = renderHook(() => {
      return useAgentSessions('claude', undefined, PROJECTS);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('bad agent');
    });
  });
});

describe('useAgentSessions reload', () => {
  test('refetches on demand', async () => {
    const fetchMock = vi.fn(() => {
      return new Response(JSON.stringify({ sessions: [session('a', '/a.jsonl')] }));
    });

    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => {
      return useAgentSessions('claude', undefined, PROJECTS);
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });

    const afterFirstLoad = fetchMock.mock.calls.length;

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(afterFirstLoad);
    });
  });
});

describe('useAgentSessions unmount safety', () => {
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
      return useAgentSessions('claude', undefined, PROJECTS);
    });

    expect(result.current.data).toBeUndefined();

    unmount();
    resolveFetch(Response.json({ sessions: [] }));

    expect(result.current.data).toBeUndefined();
  });
});

describe('useAgentSessions live polling', () => {
  test('reloads on an interval and on becoming visible, only while visible', async () => {
    const fetchMock = vi.fn(() => {
      return new Response(JSON.stringify({ sessions: [session('a', '/a.jsonl')] }));
    });

    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result, unmount } = renderHook(() => {
      return useAgentSessions('claude', undefined, PROJECTS, true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    const afterFirstLoad = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(afterFirstLoad);
    });

    const afterTick = fetchMock.mock.calls.length;

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(fetchMock.mock.calls).toHaveLength(afterTick);

    unmount();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('does not poll when live watching is off', async () => {
    const fetchMock = vi.fn(() => {
      return new Response(JSON.stringify({ sessions: [session('a', '/a.jsonl')] }));
    });

    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => {
      return useAgentSessions('claude', undefined, PROJECTS);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    const afterFirstLoad = fetchMock.mock.calls.length;

    await vi.advanceTimersByTimeAsync(9_000);

    expect(fetchMock.mock.calls).toHaveLength(afterFirstLoad);
    vi.useRealTimers();
  });

  test('does not poll while live watching is on but no agent is picked', async () => {
    const fetchSpy = vi.fn();

    vi.stubGlobal('fetch', fetchSpy);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => {
      return useAgentSessions(null, undefined, PROJECTS, true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    await vi.advanceTimersByTimeAsync(9_000);

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
