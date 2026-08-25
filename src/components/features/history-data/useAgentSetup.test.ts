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

import { useAgentSetup } from './useAgentSetup';

import type { AgentSetup } from '@services/agents/agentsService';

const SETUPS: readonly AgentSetup[] = [
  {
    agent: 'claude',
    mcpServers: [{
      name: 'context7',
      scope: 'user',
      source: '/home/.claude.json',
      command: undefined,
    }],
    rules: [{
      path: '/repo/CLAUDE.md',
      scope: 'project',
      bytes: 12,
      modifiedMs: 0,
    }],
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useAgentSetup', () => {
  test('skips fetching without a project path', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => {
      return useAgentSetup(null);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.data).toEqual({
      setups: [],
      findings: [],
      usage: null,
      plugins: [],
      trust: {
        known: false,
        trusted: false,
        onboarded: false,
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('loads setup for a project', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response(JSON.stringify({
        setups: SETUPS,
        findings: [],
      }));
    }));

    const { result } = renderHook(() => {
      return useAgentSetup('/repo');
    });

    await waitFor(() => {
      expect(result.current.data?.setups[0]?.mcpServers[0]?.name).toBe('context7');
    });
  });

  test('refetches when reloaded', async () => {
    const fetchSpy = vi.fn(() => {
      return new Response(JSON.stringify({
        setups: SETUPS,
        findings: [],
      }));
    });

    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => {
      return useAgentSetup('/repo');
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    act(() => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  test('drops a response that lands after unmount', async () => {
    let release: (() => void)
      | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });

    vi.stubGlobal('fetch', vi.fn(async () => {
      await pending;

      return new Response(JSON.stringify({
        setups: SETUPS,
        findings: [],
      }));
    }));

    const { result, unmount } = renderHook(() => {
      return useAgentSetup('/repo');
    });

    unmount();
    release?.();
    await pending;

    expect(result.current.status).toBe('loading');
  });
});
