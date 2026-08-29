import { renderHook, waitFor } from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { useFileHistory } from './useFileHistory';

const payload = {
  history: {
    path: '/repo/a.ts',
    versions: [{
      version: 1,
      savedMs: 1,
      sizeBytes: 2,
    }],
  },
  diff: null,
};

const request = {
  sessionId: 's1',
  path: '/repo/a.ts',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useFileHistory', () => {
  test('loads the versions kept for a file', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return Response.json(payload);
    }));

    const { result } = renderHook(() => {
      return useFileHistory(request);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data?.history.versions).toHaveLength(1);
  });

  test('reports a failure to read them', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"denied"}', { status: 500 });
    }));

    const { result } = renderHook(() => {
      return useFileHistory(request);
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
          resolve(Response.json(payload));
        };
      });
    }));

    const { result, unmount } = renderHook(() => {
      return useFileHistory(request);
    });

    unmount();
    resolveFetch();

    expect(result.current.data).toBeUndefined();
  });
});
