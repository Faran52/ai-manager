import {
  act,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { useAsyncResource } from './useAsyncResource';

describe('useAsyncResource', () => {
  test('never asks while it is disabled', () => {
    const load = vi.fn(() => {
      return Promise.resolve('value');
    });

    const { result } = renderHook(() => {
      return useAsyncResource(load, false);
    });

    expect(load).not.toHaveBeenCalled();
    expect(result.current.status).toBe('loading');
  });

  test('reports the loaded value, then loads again on reload', async () => {
    const load = vi.fn(() => {
      return Promise.resolve('value');
    });

    const { result } = renderHook(() => {
      return useAsyncResource(load, true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toBe('value');

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(load.mock.calls).toHaveLength(2);
    });
  });

  test('reports why a load failed', async () => {
    const load = vi.fn(() => {
      return Promise.reject(new Error('denied'));
    });

    const { result } = renderHook(() => {
      return useAsyncResource(load, true);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error).toBe('denied');
  });

  test('drops a load that settles after the caller has gone', () => {
    let release = (): void => {
      return undefined;
    };
    const load = (): Promise<string> => {
      return new Promise<string>((resolve) => {
        release = () => {
          resolve('late');
        };
      });
    };

    const { result, unmount } = renderHook(() => {
      return useAsyncResource(load, true);
    });

    unmount();
    release();

    expect(result.current.data).toBeUndefined();
  });
});
