import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

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

const noToggle = (): Promise<void> => {
  return Promise.resolve();
};

// A collapsed card no longer keeps its detail in the DOM, so a test that reads
// one has to open that card first.
const expand = async (label: RegExp): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: label }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const setup = (agent: AgentSetup['agent'], overrides: Partial<AgentSetup> = {}): AgentSetup => {
  return {
    agent,
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

test('lists every configured agent with its servers and rules', async () => {
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
      onPluginToggle={noToggle}
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

  await expand(/Claude Code/u);

  expect(screen.getByText(/2 of 3 set up/u)).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Configured agents look healthy' })).toBeDefined();
  expect(screen.getByText('Claude Code')).toBeDefined();
  expect(screen.getByText('Codex CLI')).toBeDefined();
  expect(screen.getByText('Gemini CLI')).toBeDefined();
  expect(screen.getByText('Not set up')).toBeDefined();
  expect(screen.getByText('context7')).toBeDefined();
  expect(screen.getByText('CLAUDE.md')).toBeDefined();
});

test('shows the scope a server comes from', async () => {
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
      onPluginToggle={noToggle}
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

  await expand(/Claude Code/u);

  expect(screen.getByText('user')).toBeDefined();
  expect(screen.getByText('project')).toBeDefined();
});

test('says when an agent has rules but no servers', async () => {
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
      onPluginToggle={noToggle}
      setups={[setup('codex', { rules: [rule(`${PROJECT}/AGENTS.md`, 4)] })]}
    />,
  );

  await expand(/Codex CLI/u);

  expect(screen.getByText('AGENTS.md')).toBeDefined();
  expect(screen.queryByText('None')).toBeNull();
  expect(document.querySelectorAll('[data-agent-detail] dt')).toHaveLength(1);
});

test('shortens a user-wide rules path to the home tilde', async () => {
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
      onPluginToggle={noToggle}
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

  await expand(/Codex CLI/u);

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
      onPluginToggle={noToggle}
      setups={[setup('claude', { rules: [rule(`${PROJECT}/CLAUDE.md`, 3)] })]}
    />,
  );

  expect(screen.getByText('Recorded usage')).toBeDefined();
  expect(screen.getByText(/1 of 1 set up/u)).toBeDefined();
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
      onPluginToggle={noToggle}
      setups={[setup('claude')]}
    />,
  );

  expect(screen.getByText('Recorded usage')).toBeDefined();
  expect(screen.getByText(/0 of 1 set up/u)).toBeDefined();
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
      onPluginToggle={noToggle}
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
      onPluginToggle={noToggle}
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
      onPluginToggle={noToggle}
    />,
  );

  expect(screen.getByText(/0 of 2 set up/u)).toBeDefined();
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
      onPluginToggle={noToggle}
    />,
  );

  const order = [...document.querySelectorAll('[data-agent]')].map((card) => {
    return card.getAttribute('data-agent');
  });

  expect(screen.getByText('Not set up here')).toBeDefined();
  expect(screen.getByText('1 agent needs attention')).toBeDefined();
  expect(order).toEqual(['codex', 'claude', 'gemini']);
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
      onPluginToggle={noToggle}
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
      onPluginToggle={noToggle}
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
      onPluginToggle={noToggle}
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

test('opens the plugin table in a dialog and closes it again', async () => {
  // The table reads its cost figures on mount and waits on a spinner until they land.
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response(JSON.stringify({ costs: [] }), { status: 200 }));
  }));
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
      plugins={[{
        id: 'review@official',
        marketplace: 'official',
        scope: 'user',
        enabled: true,
        version: '1.0.0',
        knownMarketplace: true,
      }]}
      nowMs={0}
      onPluginToggle={noToggle}
      setups={[setup('claude')]}
    />,
  );

  await expand(/Claude Code/u);
  await userEvent.click(screen.getByRole('button', { name: 'View plugins' }));

  expect(await screen.findByRole('switch', { name: 'review' })).toBeDefined();

  await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));

  await waitFor(() => {
    expect(screen.queryByRole('switch', { name: 'review' })).toBeNull();
  });
});

test('shuts a card that is already open instead of leaving it stuck', async () => {
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
      onPluginToggle={noToggle}
      setups={[setup('codex', { rules: [rule(`${PROJECT}/AGENTS.md`, 4)] })]}
    />,
  );

  await expand(/Codex CLI/u);

  expect(screen.getByText('AGENTS.md')).toBeDefined();

  await userEvent.click(screen.getByRole('button', {
    name: /Codex CLI/u,
    expanded: true,
  }));

  await waitFor(() => {
    expect(screen.queryByText('AGENTS.md')).toBeNull();
  });
});
