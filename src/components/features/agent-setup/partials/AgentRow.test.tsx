import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { AgentRow } from './AgentRow';

import type { AgentSetup, SetupFinding } from '@services/agents/agentsService';

const PROJECT = '/Users/dev/project';
const nowMs = Date.parse('2026-01-02T00:00:00Z');
const modifiedMs = Date.parse('2026-01-01T00:00:00Z');

const noop = (): void => {
  // The row reports intent; the panel owns what happens next.
};

const FINDING: SetupFinding = {
  agent: 'claude',
  kind: 'hook',
  summary: 'Hook script is missing or not executable',
  detail: '/gone.sh',
};

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

const renderRow = (
  agentSetup: AgentSetup,
  props: Partial<Parameters<typeof AgentRow>[0]> = {},
): void => {
  render(
    <table>
      <tbody>
        <AgentRow
          setup={agentSetup}
          projectPath={PROJECT}
          plugins={[]}
          findings={[]}
          sessionCount={0}
          nowMs={nowMs}
          columns={5}
          open={false}
          onToggle={noop}
          onOpenPlugins={noop}
          {...props}
        />
      </tbody>
    </table>,
  );
};

test('puts each count in its own column without an inline label', () => {
  renderRow(
    setup({
      mcpServers: [{
        name: 'context7',
        scope: 'user',
        source: '/home/.claude.json',
        command: undefined,
      }],
      rules: [{
        path: `${PROJECT}/CLAUDE.md`,
        scope: 'project',
        bytes: 552,
        modifiedMs,
      }],
    }),
    { sessionCount: 16 },
  );

  expect(screen.getByText('16')).toBeDefined();
  // The table has a header row now, so the figures carry no label of their own.
  expect(screen.queryByText('MCP 1')).toBeNull();
  expect(screen.queryByText('Rules 1')).toBeNull();
});

test('counts the plugins that are switched on, for claude alone', () => {
  renderRow(setup(), {
    plugins: [
      {
        id: 'review@official',
        marketplace: 'official',
        scope: 'user',
        enabled: true,
        version: '1.0.0',
        knownMarketplace: true,
      },
      {
        id: 'sleeping@official',
        marketplace: 'official',
        scope: 'user',
        enabled: false,
        version: '1.0.0',
        knownMarketplace: true,
      },
    ],
  });

  expect(screen.getByText('1/2')).toBeDefined();
});

test('dashes a column the agent records nothing for', () => {
  renderRow(setup({ agent: 'gemini' }));

  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

test('keeps the detail out of the table until the row is opened', () => {
  renderRow(setup({
    mcpServers: [{
      name: 'context7',
      scope: 'user',
      source: '/home/.claude.json',
      command: undefined,
    }],
  }));

  expect(screen.queryByText('context7')).toBeNull();
});

test('chips each server with its scope, and hides the file it came from behind it', () => {
  renderRow(
    setup({
      mcpServers: [{
        name: 'context7',
        scope: 'user',
        source: '/Users/dev/.claude.json',
        command: undefined,
      }],
    }),
    { open: true },
  );

  expect(screen.getByText('context7')).toBeDefined();
  expect(screen.getByText('user')).toBeDefined();
  // A path is long and repeats down the group, so it rides in the chip's title.
  expect(document.querySelector('[title="/Users/dev/.claude.json"]')).not.toBeNull();
});

test('prefers the launch command over the file when a server records one', () => {
  renderRow(
    setup({
      mcpServers: [{
        name: 'webstorm',
        scope: 'user',
        source: '/Users/dev/.claude.json',
        command: 'npx -y @jetbrains/mcp-proxy',
      }],
    }),
    { open: true },
  );

  expect(document.querySelector('[title="npx -y @jetbrains/mcp-proxy"]')).not.toBeNull();
});

test('sizes and ages a rules file, and calls out an empty one', () => {
  renderRow(
    setup({
      rules: [
        {
          path: `${PROJECT}/CLAUDE.md`,
          scope: 'project',
          bytes: 552,
          modifiedMs,
        },
        {
          path: '/Users/dev/.claude/CLAUDE.md',
          scope: 'user',
          bytes: 0,
          modifiedMs,
        },
      ],
    }),
    { open: true },
  );

  expect(screen.getByText('CLAUDE.md')).toBeDefined();
  expect(screen.getByText('~/.claude/CLAUDE.md')).toBeDefined();
  expect(screen.getByText(/552B/u)).toBeDefined();
  expect(screen.getByText(/empty/u)).toBeDefined();
});

test('leaves out a group the agent records nothing for', () => {
  renderRow(
    setup({
      agent: 'cursor',
      rules: [{
        path: `${PROJECT}/.cursorrules`,
        scope: 'project',
        bytes: 210,
        modifiedMs,
      }],
      modelAuth: { format: 'files' },
    }),
    { open: true },
  );

  expect(screen.getByText('.cursorrules')).toBeDefined();
  // No servers, no model and no plugins, so the pane is the one line it has.
  expect(screen.queryByText('MCP')).toBeNull();
  expect(screen.queryByText('Model')).toBeNull();
  expect(screen.queryByText('None')).toBeNull();
});

test('names the provider and credential the agent records', () => {
  renderRow(
    setup({
      agent: 'codex',
      modelAuth: {
        format: 'codex',
        model: 'gpt-5.4',
        provider: 'openai',
        authMethod: 'api-key',
      },
    }),
    { open: true },
  );

  expect(screen.getByText('gpt-5.4')).toBeDefined();
  expect(screen.getByText('openai')).toBeDefined();
  expect(screen.getByText('API key')).toBeDefined();
});

test('says nothing about credentials where the agent reports none', () => {
  renderRow(setup({
    agent: 'opencode',
    modelAuth: {
      format: 'opencode',
      model: 'sonnet',
    },
  }), { open: true });

  expect(screen.getByText('sonnet')).toBeDefined();
  expect(screen.queryByText('No credentials')).toBeNull();
});

test('leads the pane with why the row is flagged', () => {
  renderRow(setup(), {
    findings: [FINDING],
    open: true,
  });

  expect(screen.getByText('Problem')).toBeDefined();
  expect(screen.getByText('Hook script is missing or not executable')).toBeDefined();
  expect(screen.getByText('/gone.sh')).toBeDefined();
});

test('marks a flagged row and says why for a screen reader', () => {
  renderRow(setup(), { findings: [FINDING] });

  expect(screen.getByText('Check setup')).toBeDefined();
});

test('chips every server of a crowded agent rather than cutting the list', () => {
  renderRow(
    setup({
      mcpServers: Array.from({ length: 12 }, (_, index) => {
        return {
          name: `server-${String(index)}`,
          scope: 'user' as const,
          source: '/Users/dev/.claude.json',
          command: undefined,
        };
      }),
    }),
    { open: true },
  );

  expect(screen.getByText('server-0')).toBeDefined();
  expect(screen.getByText('server-11')).toBeDefined();
});

test('offers the plugin table to claude alone', () => {
  renderRow(setup(), { open: true });

  expect(screen.getByRole('button', { name: /View plugins/u })).toBeDefined();
});

test('offers no plugin table to an agent that has none', () => {
  renderRow(setup({ agent: 'codex' }), { open: true });

  expect(screen.queryByRole('button', { name: /View plugins/u })).toBeNull();
});

test('reports a click and leaves the open state to the panel', async () => {
  const onToggle = vi.fn();

  renderRow(setup(), { onToggle });

  await userEvent.click(screen.getByRole('button', { expanded: false }));

  expect(onToggle).toHaveBeenCalledTimes(1);
});

test('hands the plugin table to the panel rather than nesting it', async () => {
  const onOpenPlugins = vi.fn();

  renderRow(setup(), {
    open: true,
    onOpenPlugins,
  });

  await userEvent.click(screen.getByRole('button', { name: /View plugins/u }));

  expect(onOpenPlugins).toHaveBeenCalledTimes(1);
});
