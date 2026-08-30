import { renderHook, waitFor } from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { useNewestSessions } from './useNewestSessions';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useNewestSessions', () => {
  test('stays idle until the board asks for them', () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => {
      return useNewestSessions(false);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('gathers the newest sessions once asked', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return Response.json({ sessions: [] });
    }));

    const { result } = renderHook(() => {
      return useNewestSessions(true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
  });

  test('ignores an answer that lands after unmount', () => {
    let resolveFetch = (): void => {
      return undefined;
    };

    vi.stubGlobal('fetch', vi.fn(() => {
      return new Promise<Response>((resolve) => {
        resolveFetch = () => {
          resolve(Response.json({ sessions: [] }));
        };
      });
    }));

    const { result, unmount } = renderHook(() => {
      return useNewestSessions(true);
    });

    unmount();
    resolveFetch();

    expect(result.current.data).toBeUndefined();
  });
});
