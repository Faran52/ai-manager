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

describe('usePluginCosts for a Claude profile', () => {
  test('names the profile in the request', async () => {
    const fetchSpy = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      return new Response(JSON.stringify({
        costs: COSTS,
        seen: init != null,
      }));
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => {
      return usePluginCosts('/repo', 'Personal');
    });

    await waitFor(() => {
      expect(result.current.costs).not.toBeNull();
    });

    const init = fetchSpy.mock.calls[0]?.[1];
    const sent: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');

    expect(sent).toEqual({
      projectPath: '/repo',
      profile: 'Personal',
    });
  });
});
