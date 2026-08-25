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

import { useProjects } from './useProjects';

import type { ProjectSummary } from '@services/history/historyService';

const project = (id: string): ProjectSummary => {
  return {
    agent: 'claude',
    id,
    name: id,
    sessionCount: 1,
    messageCount: 2,
    lastActivityMs: 0,
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useProjects', () => {
  test('loads projects after mount', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response(JSON.stringify({ projects: [project('p')] }));
    }));

    const { result } = renderHook(() => {
      return useProjects();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data?.at(0)?.id).toBe('p');
  });

  test('surfaces errors with reload support', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"nope"}', { status: 500 });
    }));

    const { result } = renderHook(() => {
      return useProjects();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error).toBe('nope');

    vi.stubGlobal(
      'fetch',
      vi.fn((): Promise<Response> => {
        return Promise.resolve(new Response(JSON.stringify({ projects: [project('q')] })));
      }),
    );

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.data?.at(0)?.id).toBe('q');
    });
  });
});

describe('useProjects lifecycle', () => {
  test('ignores resolutions after unmount', () => {
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () => {
          return new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          });
        },
      ),
    );

    const { result, unmount } = renderHook(() => {
      return useProjects();
    });

    unmount();
    resolveFetch(Response.json({ projects: [] }));

    expect(result.current.status).toBe('loading');
  });
});
