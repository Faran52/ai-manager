import { renderHook, waitFor } from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { usePluginCosts } from './usePluginCosts';

const COSTS = [{
  plugin: 'context7@acme',
  alwaysOnTokens: 4210,
  onInvokeTokens: 1890,
  estimatedCostUsd: 0.0126,
}];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePluginCosts', () => {
  test('reads the figures with the table rather than behind a press', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response(JSON.stringify({ costs: COSTS }));
    }));

    const { result } = renderHook(() => {
      return usePluginCosts('/repo');
    });

    await waitFor(() => {
      expect(result.current.costs?.[0]?.alwaysOnTokens).toBe(4210);
    });
    expect(result.current.error).toBeNull();
  });

  test('reports a failure instead of an empty table', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('nope', { status: 500 });
    }));

    const { result } = renderHook(() => {
      return usePluginCosts('/repo');
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.costs).toBeNull();
  });

  test('reads again when the project changes', async () => {
    const fetchSpy = vi.fn(() => {
      return new Response(JSON.stringify({ costs: COSTS }));
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { rerender } = renderHook((path: string) => {
      return usePluginCosts(path);
    }, { initialProps: '/repo' });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    rerender('/other');

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
