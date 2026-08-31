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

import { useSearch } from './useSearch';

const isBodyWithQuery = (value: unknown): value is { query: string } => {
  return typeof value === 'object' && value !== null && 'query' in value;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSearch', () => {
  test('transitions through loading to ready with the outcome', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return new Response(JSON.stringify({
          hits: [],
          truncated: false,
        }));
      }),
    );

    const { result } = renderHook(() => {
      return useSearch();
    });

    expect(result.current.phase).toBe('idle');

    act(() => {
      result.current.run('needle', null);
    });

    expect(result.current.query).toBe('needle');
    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });
  });

  test('records failures on the error path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((): Promise<Response> => {
        return Promise.resolve(new Response('{"error":"too broad"}', { status: 400 }));
      }),
    );

    const { result } = renderHook(() => {
      return useSearch();
    });

    act(() => {
      result.current.run('a', null);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('too broad');
    });
  });
});

describe('useSearch races', () => {
  test('drops a slow response that resolves after a newer query', async () => {
    let releaseSlow: ((response: Response) => void)
      | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const raw: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
        const query = isBodyWithQuery(raw) ? raw.query : '';

        if (query === 'slow') {
          return new Promise<Response>((resolve) => {
            releaseSlow = resolve;
          });
        }

        return new Response(JSON.stringify({
          hits: [],
          truncated: false,
        }));
      }),
    );

    const { result } = renderHook(() => {
      return useSearch();
    });

    act(() => {
      result.current.run('slow', null);
    });
    act(() => {
      result.current.run('fast', null);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });

    await act(async () => {
      releaseSlow?.(new Response(JSON.stringify({
        hits: [{ stale: true }],
        truncated: false,
      })));
      await Promise.resolve();
    });

    expect(result.current.phase).toBe('ready');
    expect(result.current.outcome).toEqual({
      hits: [],
      truncated: false,
    });
  });

  test('clears a previous error when a new run starts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return Promise.reject(new TypeError('network down'));
      }),
    );

    const { result } = renderHook(() => {
      return useSearch();
    });

    act(() => {
      result.current.run('boom', null);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('error');
    });

    act(() => {
      result.current.run('again', null);
    });

    expect(result.current.error).toBeUndefined();

    // The second run fails the same way. Waiting for it keeps its rejection
    // inside the test rather than landing after the hook is torn down.
    await waitFor(() => {
      expect(result.current.phase).toBe('error');
    });
  });
});

describe('useSearch stale errors', () => {
  test('drops a slow failure that rejects after a newer query succeeded', async () => {
    let rejectSlow: ((cause: unknown) => void)
      | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const raw: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
        const query = isBodyWithQuery(raw) ? raw.query : '';

        if (query === 'slow') {
          return new Promise<Response>((_, reject) => {
            rejectSlow = reject;
          });
        }

        return new Response(JSON.stringify({
          hits: [],
          truncated: false,
        }));
      }),
    );

    const { result } = renderHook(() => {
      return useSearch();
    });

    act(() => {
      result.current.run('slow', null);
    });
    act(() => {
      result.current.run('fast', null);
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });

    await act(async () => {
      rejectSlow?.(new TypeError('late network death'));
      await Promise.resolve();
    });

    expect(result.current.phase).toBe('ready');
    expect(result.current.error).toBeUndefined();
  });
});
