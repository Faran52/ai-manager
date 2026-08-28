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

import { usePrompts } from './usePrompts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const history = {
  prompts: [],
  projects: [],
  total: 0,
};

describe('usePrompts', () => {
  test('stays idle until the panel asks for it', () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => {
      return usePrompts(false);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('loads the recorded prompts and reloads on request', async () => {
    const fetchMock = vi.fn(() => {
      return Response.json(history);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return usePrompts(true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toMatchObject({ total: 0 });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });
  });

  test('reports a failure to read them', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"unreadable"}', { status: 500 });
    }));

    const { result } = renderHook(() => {
      return usePrompts(true);
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
          resolve(Response.json(history));
        };
      });
    }));

    const { result, unmount } = renderHook(() => {
      return usePrompts(true);
    });

    unmount();
    resolveFetch();

    expect(result.current.data).toBeUndefined();
  });
});
