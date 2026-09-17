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

import { emitChange } from '@mocks/eventSource';

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

  test('reloads when the history changes, and holds a change until the window is looked at', async () => {
    const load = vi.fn(ready('tick'));

    const { result, unmount } = renderHook(() => {
      return useLiveList('one', load, true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    const afterFirstLoad = load.mock.calls.length;

    await act(async () => {
      emitChange();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(load.mock.calls.length).toBeGreaterThan(afterFirstLoad);
    });

    const afterChange = load.mock.calls.length;
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

    // A change nobody is looking at waits rather than reloading behind their back.
    await act(async () => {
      emitChange();
      await Promise.resolve();
    });

    expect(load.mock.calls).toHaveLength(afterChange);

    visibility.mockReturnValue('visible');

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(load.mock.calls.length).toBeGreaterThan(afterChange);
    });

    unmount();
  });

  test('does nothing when the window is looked at with no change waiting', async () => {
    const load = vi.fn(ready('quiet'));

    const { result } = renderHook(() => {
      return useLiveList('one', load, true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    const afterFirstLoad = load.mock.calls.length;

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(load.mock.calls).toHaveLength(afterFirstLoad);
  });

  test('never listens when live watching is off, or when there is nothing to watch', async () => {
    const load = vi.fn(ready('still'));

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

    await act(async () => {
      emitChange();
      await Promise.resolve();
    });

    expect(load.mock.calls).toHaveLength(afterFirstLoads);
  });
});
