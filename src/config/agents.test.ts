import { expect, test } from 'vitest';

import {
  agentOption,
  agentOptions,
  isAgentId,
} from './agents';

test('defines every reference agent and its capabilities', () => {
  expect(agentOptions).toHaveLength(29);
  expect(agentOptions.map((agent) => {
    return agent.id;
  })).toEqual(expect.arrayContaining([
    'claude', 'codex', 'copilot', 'gemini', 'cursor', 'aider', 'opencode', 'zed', 'trae',
  ]));
  expect(agentOption('claude')).toMatchObject({
    canDelete: true,
    canDeleteProject: true,
    canRename: true,
    format: 'claude',
    popular: true,
    supportsSidechains: true,
  });
  expect(agentOptions.filter((agent) => {
    return agent.popular === true;
  }).map((agent) => {
    return agent.id;
  })).toEqual([
    'claude', 'codex', 'copilot', 'cursor', 'opencode', 'gemini', 'cline', 'aider', 'continue',
    'amazonq', 'kiro', 'goose', 'qwen',
  ]);
  expect(agentOption('cursor')).toMatchObject({
    canDelete: false,
    canDeleteProject: false,
    format: 'sqlite',
  });
  expect(agentOption('cursor').supportsSidechains).toBeUndefined();
  expect(agentOption('opencode')).toMatchObject({
    artifact: 'shared-db',
    canDelete: true,
    canDeleteProject: false,
    canRename: false,
    format: 'opencode',
  });
  expect(isAgentId('openhands')).toBe(true);
  expect(isAgentId('unknown')).toBe(false);
  expect(() => {
    agentOption('unknown');
  }).toThrow('Unknown agent: unknown');
});
