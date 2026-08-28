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

import { useSettings } from './useSettings';

afterEach(() => {
  vi.unstubAllGlobals();
});

const scope = {
  scope: 'user',
  path: '/home/.claude/settings.json',
  exists: false,
  readable: true,
  permissions: {
    allow: [],
    deny: [],
    ask: [],
    additionalDirectories: [],
  },
  env: [],
  preservedKeys: [],
};

describe('useSettings', () => {
  test('waits until a path is offered', () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => {
      return useSettings(null);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('loads scopes for a project and reloads on request', async () => {
    const fetchMock = vi.fn(() => {
      return Response.json({ scopes: [scope] });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => {
      return useSettings('/repo');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toEqual([scope]);

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });
  });

  test('reports a failure to read them', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"denied"}', { status: 500 });
    }));

    const { result } = renderHook(() => {
      return useSettings('');
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
          resolve(Response.json({ scopes: [scope] }));
        };
      });
    }));

    const { result, unmount } = renderHook(() => {
      return useSettings('/repo');
    });

    unmount();
    resolveFetch();

    expect(result.current.data).toBeUndefined();
  });
});
