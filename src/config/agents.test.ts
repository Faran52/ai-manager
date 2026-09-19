import { expect, test } from 'vitest';

import {
  agentBadgeLabel,
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
  expect(agentOption('claude').capabilities).toEqual({
    history: true,
    manage: true,
  });
  expect(agentOption('goose').capabilities).toEqual({
    history: true,
    manage: true,
  });
  expect(agentOption('kimi').capabilities).toEqual({
    history: true,
    manage: false,
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
    artifact: 'shared-db',
    canDelete: true,
    canDeleteProject: true,
    format: 'sqlite',
  });
  expect(agentOption('cursor').supportsSidechains).toBeUndefined();
  expect(agentOption('opencode')).toMatchObject({
    artifact: 'shared-db',
    canDelete: true,
    canDeleteProject: true,
    canRename: false,
    format: 'opencode',
  });
  expect(agentOption('cline')).toMatchObject({
    artifact: 'directory',
    canDelete: true,
  });
  expect(agentOptions.filter((agent) => {
    return !agent.canDelete;
  }).map((agent) => {
    return agent.id;
  })).toEqual(['amazonq', 'kiro', 'forgecode', 'trae']);
  expect(agentOptions.every((agent) => {
    return agent.canDelete === agent.canDeleteProject;
  })).toBe(true);
  expect(isAgentId('openhands')).toBe(true);
  expect(isAgentId('unknown')).toBe(false);
  expect(() => {
    agentOption('unknown');
  }).toThrow('Unknown agent: unknown');
});

test('adds a profile qualifier to the badge only when one is set', () => {
  expect(agentBadgeLabel('claude')).toBe('Claude Code');
  expect(agentBadgeLabel('claude', 'Personal')).toBe('Claude Code Personal');
});
