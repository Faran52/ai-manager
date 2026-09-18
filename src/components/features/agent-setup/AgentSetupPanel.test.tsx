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
      status="ready"
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      findings={[]}
      usage={null}
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

const USAGE = {
  costUsd: 42,
  inputTokens: 10,
  outputTokens: 20,
  cacheReadTokens: 30,
  durationMs: 1000,
  lastActiveMs: 0,
  models: [],
};

const SETUP_COUNTS = [
  {
    configured: true,
    count: /1 of 1 set up/u,
  },
  {
    configured: false,
    count: /0 of 1 set up/u,
  },
];

test.each(SETUP_COUNTS)(
  'counts setup here and leaves recorded spend to the analytics tab (configured: $configured)',
  ({ configured, count }) => {
    render(
      <AgentSetupPanel
        projectSelected
        status="ready"
        trust={{
          known: true,
          trusted: true,
          onboarded: true,
        }}
        sessionCounts={{}}
        projectPath={PROJECT}
        findings={[]}
        usage={USAGE}
        nowMs={1000}
        onPluginToggle={noToggle}
        setups={[configured
          ? setup('claude', { rules: [rule(`${PROJECT}/CLAUDE.md`, 3)] })
          : setup('claude')]}
      />,
    );

    expect(screen.queryByText('Recorded usage')).toBeNull();
    expect(screen.getByText(count)).toBeDefined();
  },
);

test('reports every project with none selected, and claims no trust for them', () => {
  render(
    <AgentSetupPanel
      projectSelected={false}
      status="ready"
      trust={{
        known: false,
        trusted: false,
        onboarded: false,
      }}
      sessionCounts={{}}
      projectPath=""
      setups={[setup('claude', { rules: [rule('/Users/dev/.claude/CLAUDE.md')] })]}
      findings={[]}
      usage={null}
      nowMs={0}
      onPluginToggle={noToggle}
    />,
  );

  expect(screen.queryByText('No project selected')).toBeNull();
  expect(screen.queryByText('Project location unknown')).toBeNull();
  // Trust and spend are facts about one project, so neither is claimed here.
  expect(screen.queryByText('Trust unknown')).toBeNull();
  expect(screen.queryByText(/No spend recorded/u)).toBeNull();
});

test('says the location is unknown when the project has no folder', () => {
  render(
    <AgentSetupPanel
      projectSelected
      status="ready"
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
      nowMs={0}
      onPluginToggle={noToggle}
    />,
  );

  expect(screen.getByText('Project location unknown')).toBeDefined();
  expect(screen.queryByText('No agent setup found')).toBeNull();
});

test('waits on the read behind the panel', () => {
  render(
    <AgentSetupPanel
      projectSelected
      status="loading"
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      setups={[setup('claude')]}
      findings={[]}
      usage={null}
      nowMs={0}
      onPluginToggle={noToggle}
    />,
  );

  expect(screen.getByText('Loading health')).toBeDefined();
  expect(screen.queryByText('Configured agents look healthy')).toBeNull();
});

test('names every agent, set up or not', () => {
  render(
    <AgentSetupPanel
      projectSelected
      status="ready"
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
      status="ready"
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
      status="ready"
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
      status="ready"
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      usage={null}
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
      status="ready"
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      usage={null}
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
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response(JSON.stringify({ costs: [] }), { status: 200 }));
  }));
  render(
    <AgentSetupPanel
      projectSelected
      status="ready"
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      findings={[]}
      usage={null}
      nowMs={0}
      onPluginToggle={noToggle}
      setups={[setup('claude', {
        plugins: [{
          id: 'review@official',
          marketplace: 'official',
          scope: 'user',
          enabled: true,
          version: '1.0.0',
          knownMarketplace: true,
        }],
      })]}
    />,
  );

  await expand(/Claude Code/u);
  await userEvent.click(screen.getByRole('button', { name: 'View plugins' }));

  expect(await screen.findByRole('switch', { name: 'review' })).toBeDefined();

  await userEvent.keyboard('{Escape}');

  await waitFor(() => {
    expect(screen.queryByRole('switch', { name: 'review' })).toBeNull();
  });
});

test('opens an agent\'s configuration in a dialog and closes it again', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response(JSON.stringify({ scopes: [] }), { status: 200 }));
  }));
  render(
    <AgentSetupPanel
      projectSelected
      status="ready"
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      findings={[]}
      usage={null}
      nowMs={0}
      onPluginToggle={noToggle}
      setups={[setup('claude', { rules: [rule(`${PROJECT}/CLAUDE.md`)] })]}
    />,
  );

  await expand(/Claude Code/u);
  await userEvent.click(screen.getByRole('button', { name: 'View configuration' }));

  expect(await screen.findByText(/no settings file of its own/u)).toBeDefined();

  await userEvent.keyboard('{Escape}');

  await waitFor(() => {
    expect(screen.queryByText(/no settings file of its own/u)).toBeNull();
  });
});

test('shuts a card that is already open instead of leaving it stuck', async () => {
  render(
    <AgentSetupPanel
      projectSelected
      status="ready"
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      findings={[]}
      usage={null}
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

test('shows one card per Claude profile, each with its own findings and count', async () => {
  render(
    <AgentSetupPanel
      projectSelected
      status="ready"
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{
        'claude:': 3,
        'claude:Personal': 5,
      }}
      projectPath={PROJECT}
      findings={[{
        agent: 'claude',
        profile: 'Personal',
        kind: 'hook',
        summary: 'Hook script missing',
        detail: '/gone.sh',
      }]}
      usage={null}
      nowMs={0}
      onPluginToggle={noToggle}
      setups={[
        setup('claude', { rules: [rule(`${PROJECT}/CLAUDE.md`)] }),
        setup('claude', {
          profile: 'Personal',
          rules: [rule('/home/.claude-personal/CLAUDE.md')],
        }),
      ]}
    />,
  );

  expect(screen.getByText('Claude Code')).toBeDefined();
  expect(screen.getByText('Claude Code Personal')).toBeDefined();
  expect(await screen.findByText('Hook script missing')).toBeDefined();
  expect(screen.getByText('5 sessions')).toBeDefined();
});

test('opens a profile card\'s own plugins, not the default root\'s', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response(JSON.stringify({ costs: [] }), { status: 200 }));
  }));
  render(
    <AgentSetupPanel
      projectSelected
      status="ready"
      trust={{
        known: true,
        trusted: true,
        onboarded: true,
      }}
      sessionCounts={{}}
      projectPath={PROJECT}
      findings={[]}
      usage={null}
      nowMs={0}
      onPluginToggle={noToggle}
      setups={[
        setup('claude', {
          plugins: [{
            id: 'default@official',
            marketplace: 'official',
            scope: 'user',
            enabled: true,
            version: '1.0.0',
            knownMarketplace: true,
          }],
        }),
        setup('claude', {
          profile: 'Personal',
          plugins: [{
            id: 'personal@own',
            marketplace: 'own',
            scope: 'user',
            enabled: false,
            version: '2.0.0',
            knownMarketplace: true,
          }],
        }),
      ]}
    />,
  );

  await expand(/Claude Code Personal/u);
  await userEvent.click(screen.getByRole('button', { name: 'View plugins' }));

  expect(await screen.findByText('personal')).toBeDefined();
  expect(screen.queryByText('default')).toBeNull();
});
