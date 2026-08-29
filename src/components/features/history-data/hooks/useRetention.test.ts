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

import { useRetention } from './useRetention';

afterEach(() => {
  vi.unstubAllGlobals();
});

const retention = {
  policy: {
    enabled: false,
    olderThanDays: 30,
    agents: [],
  },
  due: {
    sessions: [],
  },
};

describe('useRetention', () => {
  test('stays idle until the view asks for it', () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useRetention(false);
    });

    expect(result.current.status).toBe('loading');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('loads retention status and reloads on request', async () => {
    const fetchMock = vi.fn(() => {
      return Response.json(retention);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useRetention(true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toEqual(retention);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });
  });

  test('reports a failure to read it', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"retention unavailable"}', { status: 500 });
    }));

    const { result } = renderHook(() => {
      return useRetention(true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error).toBe('retention unavailable');
  });

  test('ignores a response that lands after unmount', () => {
    let resolveFetch = (): void => {
      return undefined;
    };

    vi.stubGlobal('fetch', vi.fn(() => {
      return new Promise<Response>((resolve) => {
        resolveFetch = () => {
          resolve(Response.json(retention));
        };
      });
    }));

    const { result, unmount } = renderHook(() => {
      return useRetention(true);
    });

    unmount();
    resolveFetch();

    expect(result.current.data).toBeUndefined();
  });
});
