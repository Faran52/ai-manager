import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { AgentCard } from './AgentCard';

const nowMs = Date.parse('2026-01-02T00:00:00Z');
const modifiedMs = Date.parse('2026-01-01T00:00:00Z');

test('labels rules by size, marks empty ones, and shortens paths', () => {
  render(
    <AgentCard
      setup={{
        agent: 'gemini',
        mcpServers: [],
        rules: [
          {
            path: '/Users/dev/project/GEMINI.md',
            scope: 'project',
            bytes: 4096,
            modifiedMs,
          },
          {
            path: '/Users/dev/.gemini/GEMINI.md',
            scope: 'user',
            bytes: 0,
            modifiedMs,
          },
        ],
      }}
      projectPath="/Users/dev/project"
      plugins={[]}
      sessionCount={0}
      nowMs={nowMs}
    />,
  );

  expect(screen.getByText('GEMINI.md')).toBeDefined();
  expect(screen.getByText('~/.gemini/GEMINI.md')).toBeDefined();
  expect(screen.getByText(/4KB/u)).toBeDefined();
  expect(screen.getByText(/0B/u)).toBeDefined();
});

test('renders an unconfigured agent as a compact card without detail rows', () => {
  render(
    <AgentCard
      setup={{
        agent: 'gemini',
        mcpServers: [],
        rules: [],
      }}
      projectPath="/Users/dev/project"
      plugins={[]}
      sessionCount={3}
      nowMs={nowMs}
    />,
  );

  expect(screen.getByText('Gemini CLI')).toBeDefined();
  expect(screen.getByText('Not set up')).toBeDefined();
  expect(screen.getByText('3 sessions')).toBeDefined();
  expect(screen.queryByText('MCP')).toBeNull();
  expect(screen.queryByText('Rules')).toBeNull();
});

test('marks a healthy configured agent as ready', () => {
  render(
    <AgentCard
      setup={{
        agent: 'codex',
        mcpServers: [{
          name: 'webstorm',
          scope: 'user',
          source: '/home/.codex/config.toml',
          command: undefined,
        }],
        rules: [],
      }}
      projectPath="/Users/dev/project"
      plugins={[]}
      sessionCount={0}
      nowMs={nowMs}
    />,
  );

  expect(screen.getByText('Ready')).toBeDefined();
  expect(screen.getByText('webstorm')).toBeDefined();
});

test('flags a configured agent that a setup finding names', () => {
  render(
    <AgentCard
      setup={{
        agent: 'claude',
        mcpServers: [],
        rules: [],
      }}
      projectPath="/Users/dev/project"
      plugins={[{
        id: 'review@official',
        marketplace: 'official',
        scope: 'user',
        enabled: true,
        version: '1.0.0',
        knownMarketplace: true,
      }]}
      sessionCount={0}
      nowMs={nowMs}
      flagged
    />,
  );

  expect(screen.getByText('Check setup')).toBeDefined();
});
