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

import { useLiveList } from './useLiveList';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const ready = (value: string) => {
  return () => {
    return Promise.resolve(value);
  };
};

describe('useLiveList', () => {
  test('loads for its key and reports the result', async () => {
    const { result } = renderHook(() => {
      return useLiveList('one', ready('first'), false);
    });

    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current.data).toBe('first');
    });
  });

  test('reports a failed load through the error field', async () => {
    const { result } = renderHook(() => {
      return useLiveList('one', () => {
        return Promise.reject(new Error('bad key'));
      }, false);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('bad key');
    });
  });

  test('returns to loading the moment the key changes', async () => {
    const loads = new Map([['one', ready('first')], ['two', ready('second')]]);
    const { result, rerender } = renderHook(({ key }: { key: string }) => {
      return useLiveList(key, loads.get(key) ?? ready(''), false);
    }, { initialProps: { key: 'one' } });

    await waitFor(() => {
      expect(result.current.data).toBe('first');
    });

    rerender({ key: 'two' });

    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current.data).toBe('second');
    });
  });

  test('refetches on demand', async () => {
    const load = vi.fn(ready('again'));
    const { result } = renderHook(() => {
      return useLiveList('one', load, false);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });
  });

  test('ignores a resolution that lands after unmount', () => {
    let resolve!: (value: string) => void;
    const { result, unmount } = renderHook(() => {
      return useLiveList('one', () => {
        return new Promise<string>((done) => {
          resolve = done;
        });
      }, false);
    });

    unmount();
    resolve('late');

    expect(result.current.data).toBeUndefined();
  });

  test('polls on an interval and on becoming visible, only while visible', async () => {
    const load = vi.fn(ready('tick'));

    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result, unmount } = renderHook(() => {
      return useLiveList('one', load, true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    const afterFirstLoad = load.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    await waitFor(() => {
      expect(load.mock.calls.length).toBeGreaterThan(afterFirstLoad);
    });

    const afterTick = load.mock.calls.length;

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(load.mock.calls).toHaveLength(afterTick);

    unmount();
  });

  test('does not poll when live watching is off, or when there is nothing to watch', async () => {
    const load = vi.fn(ready('still'));

    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => {
      return useLiveList('one', load, false);
    });
    const empty = renderHook(() => {
      return useLiveList('', load, true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
      expect(empty.result.current.status).toBe('ready');
    });

    const afterFirstLoads = load.mock.calls.length;

    await vi.advanceTimersByTimeAsync(9_000);

    expect(load.mock.calls).toHaveLength(afterFirstLoads);
  });
});
