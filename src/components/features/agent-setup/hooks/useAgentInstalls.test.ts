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

import { useAgentInstalls } from './useAgentInstalls';

const jsonResponse = (body: object | string, status = 200): Response => {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
};

const CRUSH_STATUS = {
  installed: false,
  command: 'npm install -g @charmland/crush',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useAgentInstalls', () => {
  test('checks every installable agent on mount', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return jsonResponse({ agents: { crush: CRUSH_STATUS } });
    }));

    const { result } = renderHook(() => {
      return useAgentInstalls();
    });

    await waitFor(() => {
      expect(result.current.agents?.crush?.command).toBe('npm install -g @charmland/crush');
    });
    expect(result.current.checkError).toBeNull();
  });

  test('reports a check failure rather than an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return jsonResponse('nope', 500);
    }));

    const { result } = renderHook(() => {
      return useAgentInstalls();
    });

    await waitFor(() => {
      expect(result.current.checkError).not.toBeNull();
    });
    expect(result.current.agents).toBeUndefined();
  });

  test('marks the agent busy while its install is in flight, then re-checks', async () => {
    const fetchSpy = vi.fn((path: string) => {
      return Promise.resolve(path.endsWith('/agent-install')
        ? jsonResponse({ ok: true })
        : jsonResponse({
            agents: {
              crush: {
                ...CRUSH_STATUS,
                installed: true,
              },
            },
          }));
    });

    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => {
      return useAgentInstalls();
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    let installed: Promise<boolean> = Promise.resolve(false);

    act(() => {
      installed = result.current.install('crush');
    });
    expect(result.current.installingAgent).toBe('crush');

    await act(async () => {
      await expect(installed).resolves.toBe(true);
    });

    expect(result.current.installingAgent).toBeNull();
    expect(result.current.installError).toBeNull();
    await waitFor(() => {
      expect(result.current.agents?.crush?.installed).toBe(true);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  test('drops a check response that lands after unmount', async () => {
    let release: (() => void)
      | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });

    vi.stubGlobal('fetch', vi.fn(async () => {
      await pending;

      return jsonResponse({ agents: { crush: CRUSH_STATUS } });
    }));

    const { result, unmount } = renderHook(() => {
      return useAgentInstalls();
    });

    unmount();
    release?.();
    await pending;

    expect(result.current.agents).toBeUndefined();
  });

  test('drops a check failure that lands after unmount', async () => {
    let release: (() => void)
      | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });

    vi.stubGlobal('fetch', vi.fn(async () => {
      await pending;

      return jsonResponse('nope', 500);
    }));

    const { result, unmount } = renderHook(() => {
      return useAgentInstalls();
    });

    unmount();
    release?.();
    await pending;

    expect(result.current.checkError).toBeNull();
  });

  test('reports a refused install without clearing the busy state incorrectly', async () => {
    const fetchSpy = vi.fn((path: string) => {
      return Promise.resolve(path.endsWith('/agent-install')
        ? jsonResponse('network error', 502)
        : jsonResponse({ agents: { crush: CRUSH_STATUS } }));
    });

    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => {
      return useAgentInstalls();
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await expect(result.current.install('crush')).resolves.toBe(false);
    });

    expect(result.current.installingAgent).toBeNull();
    expect(result.current.installError).not.toBeNull();
  });
});
