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

interface KeyProps {
  readonly key: string;
}

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
      return useLiveList('one', ready('first'));
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
      });
    });

    await waitFor(() => {
      expect(result.current.error).toBe('bad key');
    });
  });

  test('returns to loading the moment the key changes', async () => {
    const loads = new Map([['one', ready('first')], ['two', ready('second')]]);
    const { result, rerender } = renderHook(({ key }: KeyProps) => {
      return useLiveList(key, loads.get(key) ?? ready(''));
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
      return useLiveList('one', load);
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
      });
    });

    unmount();
    resolve('late');

    expect(result.current.data).toBeUndefined();
  });
});
