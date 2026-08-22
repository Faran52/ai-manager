import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
} from 'vitest';

import { managedAgents } from '../constants';

import { readAgentSetup } from './setupUtils';

const workspace = async (): Promise<{ home: string;
  project: string; }> => {
  const root = await mkdtemp(join(tmpdir(), 'setup-'));
  const home = join(root, 'home');
  const project = join(root, 'project');

  await mkdir(home, { recursive: true });
  await mkdir(project, { recursive: true });

  return {
    home,
    project,
  };
};

describe('readAgentSetup', () => {
  test('reads Gemini servers from user and project settings, and its rules file', async () => {
    const { home, project } = await workspace();

    await mkdir(join(home, '.gemini'), { recursive: true });
    await mkdir(join(project, '.gemini'), { recursive: true });
    await writeFile(
      join(home, '.gemini', 'settings.json'),
      JSON.stringify({
        security: {},
        mcpServers: { context7: { command: 'npx' } },
      }),
    );
    await writeFile(
      join(project, '.gemini', 'settings.json'),
      JSON.stringify({ mcpServers: { local: { command: 'node' } } }),
    );
    await writeFile(join(project, 'GEMINI.md'), '# rules');

    const setup = await readAgentSetup('gemini', project, home);

    expect(setup.mcpServers).toEqual([
      {
        name: 'context7',
        scope: 'user',
        source: join(home, '.gemini', 'settings.json'),
        command: undefined,
      },
      {
        name: 'local',
        scope: 'project',
        source: join(project, '.gemini', 'settings.json'),
        command: undefined,
      },
    ]);
    expect(setup.rules).toHaveLength(1);
    expect(setup.rules[0]).toMatchObject({
      path: join(project, 'GEMINI.md'),
      scope: 'project',
      bytes: 7,
    });
    expect(setup.rules[0]?.modifiedMs).toBeGreaterThan(0);
  });

  test('separates Claude user-wide servers from the project entry in the same file', async () => {
    const { home, project } = await workspace();

    await writeFile(join(home, '.claude.json'), JSON.stringify({
      mcpServers: { everywhere: {} },
      projects: {
        [project]: { mcpServers: { chrome: {} } },
        '/somewhere/else': { mcpServers: { unrelated: {} } },
      },
    }));
    await writeFile(join(project, '.mcp.json'), JSON.stringify({ mcpServers: { shared: {} } }));

    const setup = await readAgentSetup('claude', project, home);

    expect(setup.mcpServers).toEqual([
      {
        name: 'everywhere',
        scope: 'user',
        source: join(home, '.claude.json'),
        command: undefined,
      },
      {
        name: 'chrome',
        scope: 'project',
        source: join(home, '.claude.json'),
        command: undefined,
      },
      {
        name: 'shared',
        scope: 'project',
        source: join(project, '.mcp.json'),
        command: undefined,
      },
    ]);
  });

  test('reads Codex servers from TOML headers without counting sub-tables', async () => {
    const { home, project } = await workspace();

    await mkdir(join(home, '.codex'), { recursive: true });
    await writeFile(join(home, '.codex', 'config.toml'), [
      'model = "gpt-5"',
      '[mcp_servers.playwright]',
      'command = "npx"',
      '[mcp_servers.playwright.env]',
      'TOKEN = "x"',
      '[mcp_servers."with-quotes"]',
      'command = "node"',
    ].join('\n'));

    const setup = await readAgentSetup('codex', project, home);

    expect(setup.mcpServers.map((server) => {
      return server.name;
    })).toEqual(['playwright', 'with-quotes']);
  });

  test('reports nothing rather than failing when an agent is not set up', async () => {
    const { home, project } = await workspace();

    for (const agent of managedAgents) {
      const setup = await readAgentSetup(agent, project, home);

      expect(setup).toEqual({
        agent,
        mcpServers: [],
        rules: [],
      });
    }
  });

  test('reports nothing for an agent with no setup surface', async () => {
    const { home, project } = await workspace();

    expect(await readAgentSetup('aider', project, home)).toEqual({
      agent: 'aider',
      mcpServers: [],
      rules: [],
    });
  });

  test('ignores a settings file that is not valid JSON', async () => {
    const { home, project } = await workspace();

    await mkdir(join(home, '.gemini'), { recursive: true });
    await writeFile(join(home, '.gemini', 'settings.json'), '{ truncated');

    expect((await readAgentSetup('gemini', project, home)).mcpServers).toEqual([]);
  });

  test('lists a Cursor rules directory file by file', async () => {
    const { home, project } = await workspace();

    await mkdir(join(project, '.cursor', 'rules'), { recursive: true });
    await writeFile(join(project, '.cursor', 'rules', 'style.mdc'), 'style');
    await writeFile(join(project, '.cursor', 'rules', 'api.mdc'), 'api');
    await writeFile(join(project, 'AGENTS.md'), 'shared');

    const setup = await readAgentSetup('cursor', project, home);

    expect(setup.rules.map((rule) => {
      return rule.path.replace(`${project}/`, '');
    })).toEqual(['.cursor/rules/api.mdc', '.cursor/rules/style.mdc', 'AGENTS.md']);
  });

  test('ignores a rules path that is neither a file nor a directory', async () => {
    const { home, project } = await workspace();
    const socket = createServer();

    await new Promise<void>((resolve) => {
      socket.listen(join(project, 'GEMINI.md'), resolve);
    });

    const setup = await readAgentSetup('gemini', project, home);

    await new Promise<void>((resolve) => {
      socket.close(() => {
        resolve();
      });
    });

    expect(setup.rules).toEqual([]);
  });

  test('survives hand-edited config that is malformed', async () => {
    const { home, project } = await workspace();

    await writeFile(join(home, '.claude.json'), JSON.stringify({ projects: { [project]: { trusted: true } } }));
    await mkdir(join(home, '.codex'), { recursive: true });
    await writeFile(join(home, '.codex', 'config.toml'), [
      '[mcp_servers."unterminated',
      '[mcp_servers.]',
      '[mcp_servers.good]',
    ].join('\n'));
    await mkdir(join(project, 'CLAUDE.md'), { recursive: true });

    const claude = await readAgentSetup('claude', project, home);
    const codex = await readAgentSetup('codex', project, home);

    expect(claude.mcpServers).toEqual([]);
    expect(claude.rules).toEqual([]);
    expect(codex.mcpServers.map((server) => {
      return server.name;
    })).toEqual(['good']);
  });
});
