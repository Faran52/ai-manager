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

  test('keeps only the sessions from the project\'s own profile', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response(JSON.stringify({
        sessions: [session(), {
          ...session(),
          filePath: '/personal.jsonl',
          profile: 'Personal',
        }],
      }));
    }));

    const { result } = renderHook(() => {
      return useSessions(PROJECT);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data?.map((entry) => {
      return entry.filePath;
    })).toEqual(['/f.jsonl']);
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
