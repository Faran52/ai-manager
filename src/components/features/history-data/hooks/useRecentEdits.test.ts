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

import { useRecentEdits } from './useRecentEdits';

import type { ProjectSummary } from '@services/history/historyService';

afterEach(() => {
  vi.unstubAllGlobals();
});

const PROJECT: ProjectSummary = {
  agent: 'claude',
  id: 'proj',
  name: 'Project',
  sessionCount: 1,
  messageCount: 3,
  lastActivityMs: 5,
};

const file = {
  path: '/repo/a.ts',
  edits: 2,
  writes: 0,
  sessionCount: 1,
  lastEditedMs: 5,
  recent: [],
};

describe('useRecentEdits', () => {
  test('resolves empty without fetching while the view is not asking', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useRecentEdits(null, false);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('asks about the whole machine when no project is chosen', async () => {
    const fetchMock = vi.fn(() => {
      return Response.json({ files: [] });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useRecentEdits(null);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('loads a project and reloads on request', async () => {
    const fetchMock = vi.fn(() => {
      return Response.json({ files: [file] });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useRecentEdits(PROJECT);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([file]);
    });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });
  });

  test('goes back to loading when the project changes', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return Response.json({ files: [file] });
    }));

    const { result, rerender } = renderHook(
      (project: ProjectSummary) => {
        return useRecentEdits(project);
      },
      { initialProps: PROJECT },
    );

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    rerender({
      ...PROJECT,
      id: 'other',
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
  });

  test('reports a failure to scan', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"unreadable"}', { status: 500 });
    }));

    const { result } = renderHook(() => {
      return useRecentEdits(PROJECT);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error).toBe('unreadable');
  });

  test('ignores a response that lands after unmount', () => {
    let resolveFetch = (): void => {
      return undefined;
    };

    vi.stubGlobal('fetch', vi.fn(() => {
      return new Promise<Response>((resolve) => {
        resolveFetch = () => {
          resolve(Response.json({ files: [file] }));
        };
      });
    }));

    const { result, unmount } = renderHook(() => {
      return useRecentEdits(PROJECT);
    });

    unmount();
    resolveFetch();

    expect(result.current.data).toBeUndefined();
  });
});
