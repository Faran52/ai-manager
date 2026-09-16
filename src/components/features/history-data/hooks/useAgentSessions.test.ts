import { renderHook, waitFor } from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { projectIdOf } from '@mocks/requestBodyFixtures';

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
      return useAgentSessions(null, PROJECTS);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('fans out over every project the agent owns and merges the sessions', async () => {
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      const projectId = projectIdOf(init);

      return new Response(JSON.stringify({ sessions: [session(projectId, `/${projectId}.jsonl`)] }));
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useAgentSessions({ agent: 'claude' }, PROJECTS);
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });
    expect(result.current.data?.map((entry) => {
      return entry.projectId;
    }).sort()).toEqual(['a', 'b']);
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
      const projectId = projectIdOf(init);
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
      return useAgentSessions({
        agent: 'claude',
        profile: 'Personal',
      }, projects);
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    expect(result.current.data?.[0]?.filePath).toBe('/d.jsonl');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('reports failures through the error field', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"bad agent"}', { status: 400 });
    }));

    const { result } = renderHook(() => {
      return useAgentSessions({ agent: 'claude' }, PROJECTS);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('bad agent');
    });
  });
});
