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

import { readModelAuth } from './modelAuthUtils';
import {
  readAgentMcp,
  readAgentRules,
  readAgentSetup,
} from './setupUtils';

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
        modelAuth: await readModelAuth(agent, home),
      });
    }
  });

  test('reports nothing for an agent with no setup surface', async () => {
    const { home, project } = await workspace();

    expect(await readAgentSetup('aider', project, home)).toEqual({
      agent: 'aider',
      mcpServers: [],
      rules: [],
      modelAuth: await readModelAuth('aider', home),
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

  test('lists nothing for an agent without a setup spec', async () => {
    await expect(readAgentMcp('aider', '/projects/demo', '/home/x')).resolves.toEqual([]);
    await expect(readAgentRules('aider', '/projects/demo', '/home/x')).resolves.toEqual([]);
  });

  test('reads antigravity MCP from user and project config files', async () => {
    const { home, project } = await workspace();

    await mkdir(join(home, '.gemini', 'config'), { recursive: true });
    await mkdir(join(project, '.agents'), { recursive: true });
    await writeFile(join(home, '.gemini', 'config', 'mcp_config.json'), JSON.stringify({
      mcpServers: { context7: { command: 'npx' } },
    }));
    await writeFile(join(project, '.agents', 'mcp_config.json'), JSON.stringify({
      mcpServers: { local: { command: 'node' } },
    }));

    const mcp = await readAgentMcp('antigravity', project, home);

    expect(mcp.map((server) => {
      return [server.name, server.scope];
    })).toEqual([['context7', 'user'], ['local', 'project']]);
  });

  test('reads antigravity rules from project and user locations', async () => {
    const { home, project } = await workspace();

    await writeFile(join(project, 'AGENTS.md'), 'rules');
    await mkdir(join(home, '.gemini'), { recursive: true });
    await writeFile(join(home, '.gemini', 'GEMINI.md'), 'global rules');

    const rules = await readAgentRules('antigravity', project, home);

    expect(rules).toEqual([
      expect.objectContaining({
        path: join(project, 'AGENTS.md'),
        scope: 'project',
      }),
      expect.objectContaining({
        path: join(home, '.gemini', 'GEMINI.md'),
        scope: 'user',
      }),
    ]);
  });

  test('reads grok MCP from TOML user and project configs', async () => {
    const { home, project } = await workspace();

    await mkdir(join(home, '.grok'), { recursive: true });
    await mkdir(join(project, '.grok'), { recursive: true });
    await writeFile(join(home, '.grok', 'config.toml'), [
      '[mcp_servers.context7]',
      'command = "npx"',
    ].join('\n'));
    await writeFile(join(project, '.grok', 'config.toml'), [
      '[mcp_servers.local]',
      'command = "node"',
    ].join('\n'));

    const mcp = await readAgentMcp('grok', project, home);

    expect(mcp.map((server) => {
      return [server.name, server.scope];
    })).toEqual([['context7', 'user'], ['local', 'project']]);
  });

  test('reads grok rules from project AGENTS.md and user GEMINI.md-style file', async () => {
    const { home, project } = await workspace();

    await writeFile(join(project, 'AGENTS.md'), 'rules');
    await mkdir(join(home, '.grok'), { recursive: true });
    await writeFile(join(home, '.grok', 'AGENTS.md'), 'global rules');

    const rules = await readAgentRules('grok', project, home);

    expect(rules).toEqual([
      expect.objectContaining({
        path: join(project, 'AGENTS.md'),
        scope: 'project',
      }),
      expect.objectContaining({
        path: join(home, '.grok', 'AGENTS.md'),
        scope: 'user',
      }),
    ]);
  });

  test('reads cursor-agent MCP from user and project mcp.json', async () => {
    const { home, project } = await workspace();

    await mkdir(join(home, '.cursor'), { recursive: true });
    await writeFile(join(home, '.cursor', 'mcp.json'), JSON.stringify({
      mcpServers: { context7: { command: 'npx' } },
    }));
    await mkdir(join(project, '.cursor'), { recursive: true });
    await writeFile(join(project, '.cursor', 'mcp.json'), JSON.stringify({
      mcpServers: { local: { command: 'node' } },
    }));

    const mcp = await readAgentMcp('cursor-agent', project, home);

    expect(mcp.map((server) => {
      return [server.name, server.scope];
    })).toEqual([['context7', 'user'], ['local', 'project']]);
  });

  test('reads cursor-agent rules from project directory, AGENTS.md, and user rules', async () => {
    const { home, project } = await workspace();

    await mkdir(join(project, '.cursor', 'rules'), { recursive: true });
    await writeFile(join(project, '.cursor', 'rules', 'style.mdc'), 'style');
    await writeFile(join(project, 'AGENTS.md'), 'shared');
    await mkdir(join(home, '.cursor', 'rules'), { recursive: true });
    await writeFile(join(home, '.cursor', 'rules', 'global.mdc'), 'global');

    const rules = await readAgentRules('cursor-agent', project, home);

    const paths = rules.map((rule) => {
      return rule.path.replace(`${project}/`, '');
    });
    expect(paths).toContain('.cursor/rules/style.mdc');
    expect(paths).toContain('AGENTS.md');
    expect(rules.find((rule) => {
      return rule.path.endsWith('global.mdc');
    })).toMatchObject({ scope: 'user' });
  });
});
