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

import { useArchives } from './useArchives';

afterEach(() => {
  vi.unstubAllGlobals();
});

const archive = {
  id: '2026-07-01T00-00-00-000Z',
  createdMs: 1,
  note: '',
  sessionCount: 1,
  sizeBytes: 10,
  agents: ['claude'],
};

describe('useArchives', () => {
  test('stays idle until the view asks for it', () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useArchives(false);
    });

    expect(result.current.status).toBe('loading');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('loads archives and reloads on request', async () => {
    const fetchMock = vi.fn(() => {
      return Response.json({ archives: [archive] });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useArchives(true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toEqual([archive]);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });
  });

  test('reports a failure to list them', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"no archives folder"}', { status: 500 });
    }));

    const { result } = renderHook(() => {
      return useArchives(true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error).toBe('no archives folder');
  });

  test('ignores a response that lands after unmount', () => {
    let resolveFetch = (): void => {
      return undefined;
    };

    vi.stubGlobal('fetch', vi.fn(() => {
      return new Promise<Response>((resolve) => {
        resolveFetch = () => {
          resolve(Response.json({ archives: [archive] }));
        };
      });
    }));

    const { result, unmount } = renderHook(() => {
      return useArchives(true);
    });

    unmount();
    resolveFetch();

    expect(result.current.data).toBeUndefined();
  });
});
