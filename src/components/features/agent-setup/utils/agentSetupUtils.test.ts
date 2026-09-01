import {
  describe,
  expect,
  it,
} from 'vitest';

import { agentIsConfigured } from './agentSetupUtils';

import type { AgentSetup, InstalledPlugin } from '@services/agents/agentsService';

describe('agentIsConfigured', () => {
  const baseSetup = (agent: AgentSetup['agent']): AgentSetup => {
    return {
      agent,
      mcpServers: [],
      rules: [],
      modelAuth: { format: 'files' as const },
    };
  };
  const plugin = (id: string): InstalledPlugin => {
    return {
      id,
      marketplace: 'marketplace',
      scope: 'user',
      enabled: true,
      version: '1.0.0',
      knownMarketplace: true,
    };
  };

  it('is false for a bare setup without plugins', () => {
    expect(agentIsConfigured(baseSetup('codex'), [])).toBe(false);
  });

  it('counts MCP servers or rules files as setup', () => {
    const withServer = baseSetup('gemini');

    expect(agentIsConfigured({
      ...withServer,
      mcpServers: [{
        name: 'search',
        scope: 'user',
        source: '/s',
        command: undefined,
      }],
    }, [])).toBe(true);

    expect(agentIsConfigured({
      ...withServer,
      rules: [{
        path: '/r',
        scope: 'project',
        bytes: 3,
        modifiedMs: 1,
      }],
    }, [])).toBe(true);
  });

  it('counts plugins only for Claude', () => {
    expect(agentIsConfigured(baseSetup('codex'), [plugin('x')])).toBe(false);
    expect(agentIsConfigured(baseSetup('claude'), [plugin('x')])).toBe(true);
  });
});
