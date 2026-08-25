import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { AgentSetupPanel } from './AgentSetupPanel';

import type { AgentSetup } from '@services/agents/agentsService';

const PROJECT = '/Users/dev/Projects/app';

const rule = (path: string, bytes = 4): AgentSetup['rules'][number] => {
  return {
    path,
    scope: 'project',
    bytes,
    modifiedMs: 0,
  };
};

const setup = (agent: AgentSetup['agent'], overrides: Partial<AgentSetup> = {}): AgentSetup => {
  return {
    agent,
    mcpServers: [],
    rules: [],
    ...overrides,
  };
};

test('lists every configured agent with its servers and rules', () => {
  render(
    <AgentSetupPanel
      projectSelected
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      findings={[]}
      usage={null}
      plugins={[]}
      nowMs={0}
      setups={[
        setup('claude', {
          mcpServers: [{
            name: 'context7',
            scope: 'user',
            source: '/home/.claude.json',
            command: undefined,
          }],
          rules: [rule(`${PROJECT}/CLAUDE.md`, 10)],
        }),
        setup('codex', {
          mcpServers: [{
            name: 'webstorm',
            scope: 'user',
            source: '/home/.codex/config.toml',
            command: undefined,
          }],
        }),
        setup('gemini'),
      ]}
    />,
  );

  expect(screen.getByText('2 of 3 agents set up for this project')).toBeDefined();
  expect(screen.getByText('Claude Code')).toBeDefined();
  expect(screen.getByText('Codex CLI')).toBeDefined();
  expect(screen.getByText('Gemini CLI')).toBeDefined();
  expect(screen.getByText('Not set up')).toBeDefined();
  expect(screen.getByText('context7')).toBeDefined();
  expect(screen.getByText('CLAUDE.md')).toBeDefined();
});

test('shows the scope a server comes from', () => {
  render(
    <AgentSetupPanel
      projectSelected
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      findings={[]}
      usage={null}
      plugins={[]}
      nowMs={0}
      setups={[
        setup('claude', {
          mcpServers: [
            {
              name: 'everywhere',
              scope: 'user',
              source: '/home/.claude.json',
              command: undefined,
            },
            {
              name: 'local',
              scope: 'project',
              source: `${PROJECT}/.mcp.json`,
              command: undefined,
            },
          ],
        }),
      ]}
    />,
  );

  expect(screen.getByText('user')).toBeDefined();
  expect(screen.getByText('project')).toBeDefined();
});

test('says when an agent has rules but no servers', () => {
  render(
    <AgentSetupPanel
      projectSelected
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      findings={[]}
      usage={null}
      plugins={[]}
      nowMs={0}
      setups={[setup('codex', { rules: [rule(`${PROJECT}/AGENTS.md`, 4)] })]}
    />,
  );

  expect(screen.getByText('None')).toBeDefined();
  expect(screen.getByText('AGENTS.md')).toBeDefined();
});

test('shortens a user-wide rules path to the home tilde', () => {
  render(
    <AgentSetupPanel
      projectSelected
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      findings={[]}
      usage={null}
      plugins={[]}
      nowMs={0}
      setups={[
        setup('codex', {
          rules: [
            rule(`${PROJECT}/AGENTS.md`, 4),
            {
              path: '/Users/dev/.codex/AGENTS.md',
              scope: 'user',
              bytes: 9,
              modifiedMs: 0,
            },
          ],
        }),
      ]}
    />,
  );

  expect(screen.getByText('AGENTS.md')).toBeDefined();
  expect(screen.getByText('~/.codex/AGENTS.md')).toBeDefined();
});

const USAGE = {
  costUsd: 42,
  inputTokens: 10,
  outputTokens: 20,
  cacheReadTokens: 30,
  durationMs: 1000,
  lastActiveMs: 0,
  models: [],
};

test('shows recorded spend alongside configured agents', () => {
  render(
    <AgentSetupPanel
      projectSelected
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      findings={[]}
      usage={USAGE}
      plugins={[]}
      nowMs={1000}
      setups={[setup('claude', { rules: [rule(`${PROJECT}/CLAUDE.md`, 3)] })]}
    />,
  );

  expect(screen.getByText('Recorded usage')).toBeDefined();
  expect(screen.getByText('1 of 1 agents set up for this project')).toBeDefined();
});

test('shows recorded spend even when no agent is configured', () => {
  render(
    <AgentSetupPanel
      projectSelected
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      findings={[]}
      usage={USAGE}
      plugins={[]}
      nowMs={1000}
      setups={[setup('claude')]}
    />,
  );

  expect(screen.getByText('Recorded usage')).toBeDefined();
  expect(screen.getByText('0 of 1 agents set up for this project')).toBeDefined();
});

test('asks for a project before anything else', () => {
  render(
    <AgentSetupPanel
      projectSelected={false}
      trust={{
        known: false,
        trusted: false,
        onboarded: false,
      }}
      sessionCounts={{}}
      projectPath=""
      setups={[]}
      findings={[]}
      usage={null}
      plugins={[]}
      nowMs={0}
    />,
  );

  expect(screen.getByText('No project selected')).toBeDefined();
  expect(screen.queryByText('Project location unknown')).toBeNull();
});

test('says the location is unknown when the project has no folder', () => {
  render(
    <AgentSetupPanel
      projectSelected
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath=""
      setups={[setup('claude')]}
      findings={[]}
      usage={null}
      plugins={[]}
      nowMs={0}
    />,
  );

  expect(screen.getByText('Project location unknown')).toBeDefined();
  expect(screen.queryByText('No agent setup found')).toBeNull();
});

test('names every agent, set up or not', () => {
  render(
    <AgentSetupPanel
      projectSelected
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      setups={[setup('claude'), setup('codex')]}
      findings={[]}
      usage={null}
      plugins={[]}
      nowMs={0}
    />,
  );

  expect(screen.getByText('0 of 2 agents set up for this project')).toBeDefined();
  expect(screen.getAllByText('Not set up')).toHaveLength(2);
});

test('orders flagged agents first, then healthy, then unused', () => {
  render(
    <AgentSetupPanel
      projectSelected
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      setups={[
        setup('codex', { rules: [rule(`${PROJECT}/AGENTS.md`, 4)] }),
        setup('claude', { rules: [rule(`${PROJECT}/CLAUDE.md`, 3)] }),
        setup('gemini'),
      ]}
      findings={[{
        agent: 'codex',
        kind: 'hook',
        summary: 'Hook script is missing or not executable',
        detail: '/gone.sh',
      }]}
      usage={null}
      plugins={[]}
      nowMs={0}
    />,
  );

  const flagged = screen.getByText('Codex CLI');
  const healthy = screen.getByText('Claude Code');
  const unused = screen.getByText('Gemini CLI');

  expect(screen.getByText('Needs attention')).toBeDefined();
  expect(screen.getByText('Not set up here')).toBeDefined();
  expect(flagged.compareDocumentPosition(healthy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(healthy.compareDocumentPosition(unused) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('flags an agent that a setup finding names', () => {
  render(
    <AgentSetupPanel
      projectSelected
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      setups={[setup('claude', { rules: [rule(`${PROJECT}/CLAUDE.md`, 3)] })]}
      findings={[{
        agent: 'claude',
        kind: 'mcp',
        summary: 'Server was never approved',
        detail: 'pending',
      }]}
      usage={null}
      plugins={[]}
      nowMs={0}
    />,
  );

  expect(screen.getByText('Check setup')).toBeDefined();
});

test('leads with setup problems when there are any', () => {
  render(
    <AgentSetupPanel
      projectSelected
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      usage={null}
      plugins={[]}
      nowMs={0}
      findings={[{
        agent: 'claude',
        kind: 'hook',
        summary: 'Hook script is missing or not executable',
        detail: '/gone.sh',
      }]}
      setups={[setup('claude', { rules: [rule(`${PROJECT}/CLAUDE.md`, 3)] })]}
    />,
  );

  expect(screen.getByText('1 setup problem')).toBeDefined();
  expect(screen.getByText('Hook script is missing or not executable')).toBeDefined();
  expect(screen.getByText('/gone.sh')).toBeDefined();
});

test('counts multiple setup problems', () => {
  render(
    <AgentSetupPanel
      projectSelected
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      usage={null}
      plugins={[]}
      nowMs={0}
      findings={[
        {
          agent: 'claude',
          kind: 'hook',
          summary: 'Hook script is missing',
          detail: '/gone.sh',
        },
        {
          agent: 'claude',
          kind: 'mcp',
          summary: 'Server was never approved',
          detail: 'pending',
        },
      ]}
      setups={[setup('claude')]}
    />,
  );

  expect(screen.getByText('2 setup problems')).toBeDefined();
});
