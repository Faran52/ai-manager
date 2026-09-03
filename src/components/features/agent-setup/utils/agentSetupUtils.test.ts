import { expect, test } from 'vitest';

import { agentIsConfigured, modelSummaryOf } from './agentSetupUtils';

import type { AgentSetup } from '@services/agents/agentsService';

const setup = (overrides: Partial<AgentSetup> = {}): AgentSetup => {
  return {
    agent: 'claude',
    mcpServers: [],
    rules: [],
    modelAuth: {
      format: 'claude',
      model: undefined,
      authMethod: 'none',
    },
    ...overrides,
  };
};

test('counts an agent as set up once it has servers, rules or claude plugins', () => {
  expect(agentIsConfigured(setup(), [])).toBe(false);
  expect(agentIsConfigured(setup({
    rules: [{
      path: '/CLAUDE.md',
      scope: 'project',
      bytes: 4,
      modifiedMs: 0,
    }],
  }), [])).toBe(true);
  expect(agentIsConfigured(setup(), [{
    id: 'review@official',
    marketplace: 'official',
    scope: 'user',
    enabled: true,
    version: '1.0.0',
    knownMarketplace: true,
  }])).toBe(true);
});

test('reads the model and credentials a claude setup records', () => {
  expect(modelSummaryOf({
    format: 'claude',
    model: 'claude-opus-5',
    authMethod: 'oauth',
  })).toEqual({
    model: 'claude-opus-5',
    authMethod: 'oauth',
    provider: undefined,
  });
});

test('carries the provider a codex setup adds', () => {
  expect(modelSummaryOf({
    format: 'codex',
    model: 'gpt-5.4',
    provider: 'openai',
    authMethod: 'api-key',
  })).toEqual({
    model: 'gpt-5.4',
    authMethod: 'api-key',
    provider: 'openai',
  });
});

test('leaves every field unset for a reader that records neither', () => {
  expect(modelSummaryOf({ format: 'sqlite' })).toEqual({
    model: undefined,
    authMethod: undefined,
    provider: undefined,
  });
});
