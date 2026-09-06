import { renderHook } from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { usePluginToggle } from './usePluginToggle';

import type { InstalledPlugin } from '@services/agents/agentsService';

const PLUGIN: InstalledPlugin = {
  id: 'context7@acme',
  marketplace: 'acme',
  scope: 'user',
  enabled: true,
  version: '1.4.0',
  knownMarketplace: true,
};

const bodyOf = (init: RequestInit | undefined): string => {
  return typeof init?.body === 'string' ? init.body : '{}';
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePluginToggle', () => {
  test('asks to disable a plugin that is on', async () => {
    const fetchSpy = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      return new Response(JSON.stringify({
        ok: true,
        seen: init != null,
      }));
    });
    vi.stubGlobal('fetch', fetchSpy);
    const reload = vi.fn();

    const { result } = renderHook(() => {
      return usePluginToggle('/repo', reload);
    });
    await result.current(PLUGIN);

    const sent: unknown = JSON.parse(bodyOf(fetchSpy.mock.calls[0]?.[1]));

    expect(sent).toEqual({
      projectPath: '/repo',
      plugin: 'context7@acme',
      scope: 'user',
      action: 'disable',
    });
  });

  test('asks to enable a plugin that is off', async () => {
    const fetchSpy = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      return new Response(JSON.stringify({
        ok: true,
        seen: init != null,
      }));
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => {
      return usePluginToggle('/repo', vi.fn());
    });
    await result.current({
      ...PLUGIN,
      enabled: false,
    });

    const sent: unknown = JSON.parse(bodyOf(fetchSpy.mock.calls[0]?.[1]));

    expect(sent).toEqual({
      projectPath: '/repo',
      plugin: 'context7@acme',
      scope: 'user',
      action: 'enable',
    });
  });

  test('reloads after a successful write', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response(JSON.stringify({ ok: true }));
    }));
    const reload = vi.fn();

    const { result } = renderHook(() => {
      return usePluginToggle('/repo', reload);
    });
    await result.current(PLUGIN);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  test('reloads even when the write fails, and lets the failure through', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('nope', { status: 500 });
    }));
    const reload = vi.fn();

    const { result } = renderHook(() => {
      return usePluginToggle('/repo', reload);
    });

    await expect(result.current(PLUGIN)).rejects.toBeDefined();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
