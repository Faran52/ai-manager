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

import { useStorage } from './useStorage';

afterEach(() => {
  vi.unstubAllGlobals();
});

const report = {
  agents: [],
  totalBytes: 0,
  partial: false,
};

describe('useStorage', () => {
  test('stays idle until the panel asks for it', () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => {
      return useStorage(false);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('loads the report and reloads on request', async () => {
    const fetchMock = vi.fn(() => {
      return Response.json(report);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useStorage(true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });
  });

  test('reports a failure to measure', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"denied"}', { status: 500 });
    }));

    const { result } = renderHook(() => {
      return useStorage(true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error).toBe('denied');
  });

  test('ignores a response that lands after unmount', () => {
    let resolveFetch = (): void => {
      return undefined;
    };

    vi.stubGlobal('fetch', vi.fn(() => {
      return new Promise<Response>((resolve) => {
        resolveFetch = () => {
          resolve(Response.json(report));
        };
      });
    }));

    const { result, unmount } = renderHook(() => {
      return useStorage(true);
    });

    unmount();
    resolveFetch();

    expect(result.current.data).toBeUndefined();
  });
});
