import {
  chmod,
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
} from 'vitest';

import { validateAgentSetup } from './validationUtils';

const workspace = async (): Promise<{ home: string;
  project: string; }> => {
  const root = await mkdtemp(join(tmpdir(), 'validate-'));
  const home = join(root, 'home');
  const project = join(root, 'project');

  await mkdir(join(home, '.claude', 'plugins'), { recursive: true });
  await mkdir(join(project, '.claude'), { recursive: true });

  return {
    home,
    project,
  };
};

const userSettings = async (home: string, settings: object): Promise<void> => {
  await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify(settings));
};

const projectSettings = async (project: string, settings: object): Promise<void> => {
  await writeFile(join(project, '.claude', 'settings.json'), JSON.stringify(settings));
};

const hook = (command: string): object => {
  return {
    hooks: {
      SessionStart: [{
        matcher: 'startup',
        hooks: [{
          type: 'command',
          command,
        }],
      }],
    },
  };
};

describe('validateAgentSetup', () => {
  test('reports nothing for a healthy setup', async () => {
    const { home, project } = await workspace();
    const script = join(project, 'run.sh');

    await writeFile(script, '#!/bin/sh\n');
    await chmod(script, 0o755);
    await userSettings(home, hook(`'${script}' --flag`));

    expect(await validateAgentSetup('claude', project, home)).toEqual([]);
  });

  test('reports a hook script that is missing', async () => {
    const { home, project } = await workspace();

    await userSettings(home, hook(`${join(project, 'gone.sh')} --flag`));

    expect(await validateAgentSetup('claude', project, home)).toEqual([
      expect.objectContaining({
        kind: 'hook',
        detail: join(project, 'gone.sh'),
      }),
    ]);
  });

  test('reports a hook script that is not executable', async () => {
    const { home, project } = await workspace();
    const script = join(project, 'run.sh');

    await writeFile(script, '#!/bin/sh\n');
    await chmod(script, 0o644);
    await userSettings(home, hook(`"${script}"`));

    expect(await validateAgentSetup('claude', project, home)).toEqual([
      expect.objectContaining({
        kind: 'hook',
        detail: script,
      }),
    ]);
  });

  test('ignores a hook that runs a command found on PATH', async () => {
    const { home, project } = await workspace();

    await userSettings(home, hook('echo hello'));

    expect(await validateAgentSetup('claude', project, home)).toEqual([]);
  });

  test('reports a plugin enabled from an unknown marketplace', async () => {
    const { home, project } = await workspace();

    await writeFile(
      join(home, '.claude', 'plugins', 'known_marketplaces.json'),
      JSON.stringify({ official: {} }),
    );
    await userSettings(home, {
      enabledPlugins: {
        'good@official': true,
        'orphan@vanished': true,
      },
    });

    expect(await validateAgentSetup('claude', project, home)).toEqual([
      expect.objectContaining({
        kind: 'plugin',
        detail: 'orphan@vanished',
      }),
    ]);
  });

  test('accepts a marketplace declared only in settings', async () => {
    const { home, project } = await workspace();

    await userSettings(home, {
      enabledPlugins: { 'local@extra': true },
      extraKnownMarketplaces: {
        extra: {
          source: {
            source: 'github',
            repo: 'a/b',
          },
        },
      },
    });

    expect(await validateAgentSetup('claude', project, home)).toEqual([]);
  });

  test('reports a marketplace folder that no longer resolves', async () => {
    const { home, project } = await workspace();

    await mkdir(join(project, 'plugins', 'present'), { recursive: true });
    await projectSettings(project, {
      extraKnownMarketplaces: {
        present: {
          source: {
            source: 'directory',
            path: './plugins/present',
          },
        },
        local: {
          source: {
            source: 'directory',
            path: './plugins/local',
          },
        },
        remote: {
          source: {
            source: 'github',
            repo: 'a/b',
          },
        },
      },
    });

    expect(await validateAgentSetup('claude', project, home)).toEqual([
      expect.objectContaining({
        kind: 'marketplace',
        detail: `local → ${join(project, 'plugins', 'local')}`,
      }),
    ]);
  });

  test('reports a project MCP server that was never approved', async () => {
    const { home, project } = await workspace();

    await writeFile(join(project, '.mcp.json'), JSON.stringify({
      mcpServers: {
        approved: {},
        refused: {},
        pending: {},
      },
    }));
    await writeFile(join(home, '.claude.json'), JSON.stringify({
      projects: {
        [project]: {
          enabledMcpjsonServers: ['approved'],
          disabledMcpjsonServers: ['refused'],
        },
      },
    }));

    expect(await validateAgentSetup('claude', project, home)).toEqual([
      expect.objectContaining({
        kind: 'mcp',
        detail: 'pending',
      }),
    ]);
  });

  test('reports nothing when a project declares no MCP servers', async () => {
    const { home, project } = await workspace();

    await writeFile(join(project, '.mcp.json'), JSON.stringify({ other: {} }));

    expect(await validateAgentSetup('claude', project, home)).toEqual([]);
  });

  test('reads past every shape a hand-edited settings file can take', async () => {
    const { home, project } = await workspace();

    await userSettings(home, {
      hooks: {
        NotAnArray: { matcher: 'x' },
        Empty: [{ matcher: 'x' }],
        Wrong: [42, { hooks: 'no' }, { hooks: [17, { type: 'command' }, { command: 9 }] }],
        Unterminated: [{ hooks: [{ command: '"/never/closed' }] }],
      },
      enabledPlugins: { 'no-marketplace-suffix': true },
      extraKnownMarketplaces: {
        notAnObject: 'text',
        bare: {},
        sourceless: { source: 'text' },
        pathless: { source: { source: 'directory' } },
      },
    });

    expect(await validateAgentSetup('claude', project, home)).toEqual([]);
  });

  test('resolves an absolute marketplace path as given', async () => {
    const { home, project } = await workspace();

    await projectSettings(project, {
      extraKnownMarketplaces: {
        gone: {
          source: {
            source: 'directory',
            path: '/absolutely/not/here',
          },
        },
      },
    });

    expect(await validateAgentSetup('claude', project, home)).toEqual([
      expect.objectContaining({
        kind: 'marketplace',
        detail: 'gone → /absolutely/not/here',
      }),
    ]);
  });

  test('ignores an approval list that is not a list of names', async () => {
    const { home, project } = await workspace();

    await writeFile(join(project, '.mcp.json'), JSON.stringify({ mcpServers: { pending: {} } }));
    await writeFile(join(home, '.claude.json'), JSON.stringify({
      projects: {
        [project]: {
          enabledMcpjsonServers: [7, 'other'],
          disabledMcpjsonServers: 'nope',
        },
      },
    }));

    expect(await validateAgentSetup('claude', project, home)).toEqual([
      expect.objectContaining({
        kind: 'mcp',
        detail: 'pending',
      }),
    ]);
  });
});

describe('codex', () => {
  const codexHome = async (config: string): Promise<string> => {
    const root = await mkdtemp(join(tmpdir(), 'validate-codex-'));

    await mkdir(join(root, '.codex'), { recursive: true });
    await writeFile(join(root, '.codex', 'config.toml'), config);

    return root;
  };

  test('reports a server whose command is not there', async () => {
    const home = await codexHome([
      '[mcp_servers.ghost]',
      'command = "/nowhere/ghost-server"',
      'args = []',
    ].join('\n'));

    expect(await validateAgentSetup('codex', '/repo', home)).toEqual([{
      agent: 'codex',
      kind: 'mcp',
      summary: 'MCP server command is missing or not executable',
      detail: 'ghost → /nowhere/ghost-server',
    }]);
  });

  test('accepts a server whose command is there and runnable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'validate-codex-bin-'));
    const binary = join(root, 'real-server');

    await writeFile(binary, '#!/bin/sh\n');
    await chmod(binary, 0o755);

    const home = await codexHome(`[mcp_servers.real]\ncommand = "${binary}"\n`);

    expect(await validateAgentSetup('codex', '/repo', home)).toEqual([]);
  });

  test('reports a command that exists but cannot be run', async () => {
    const root = await mkdtemp(join(tmpdir(), 'validate-codex-noexec-'));
    const binary = join(root, 'not-runnable');

    await writeFile(binary, 'text');
    await chmod(binary, 0o644);

    const home = await codexHome(`[mcp_servers.blocked]\ncommand = "${binary}"\n`);

    expect(await validateAgentSetup('codex', '/repo', home)).toHaveLength(1);
  });

  test('leaves a server the config turned off alone', async () => {
    const home = await codexHome([
      '[mcp_servers.off]',
      'command = "/nowhere/off-server"',
      'enabled = false',
    ].join('\n'));

    expect(await validateAgentSetup('codex', '/repo', home)).toEqual([]);
  });

  test('leaves a server with no local command to check', async () => {
    const home = await codexHome([
      '[mcp_servers.remote]',
      'url = "http://127.0.0.1:1234/stream"',
      '',
      '[mcp_servers.on_path]',
      'command = "uvx"',
      '',
      '[mcp_servers.relative]',
      'command = "./Some App/bin/server"',
      'cwd = "."',
    ].join('\n'));

    expect(await validateAgentSetup('codex', '/repo', home)).toEqual([]);
  });

  test('never reads an env block as though it were the server', async () => {
    const home = await codexHome([
      '[mcp_servers.node_repl]',
      'command = "/nowhere/node_repl"',
      '',
      '[mcp_servers.node_repl.env]',
      'NODE_REPL_NODE_PATH = "/nowhere/also-missing"',
      'command = "/nowhere/not-the-command"',
    ].join('\n'));
    const findings = await validateAgentSetup('codex', '/repo', home);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toBe('node_repl → /nowhere/node_repl');
  });

  test('reads a server whose name the config quoted', async () => {
    const home = await codexHome([
      '[mcp_servers."my server"]',
      'command = "/nowhere/quoted"',
    ].join('\n'));

    expect((await validateAgentSetup('codex', '/repo', home))[0]?.detail)
      .toBe('my server → /nowhere/quoted');
  });

  test('reports nothing when there is no codex config at all', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'validate-codex-none-'));

    expect(await validateAgentSetup('codex', '/repo', empty)).toEqual([]);
  });

  test('reports nothing for an agent with no validator', async () => {
    expect(await validateAgentSetup('cursor', '/repo', await codexHome(''))).toEqual([]);
  });

  test('keeps other sections of the config out of the servers', async () => {
    const home = await codexHome([
      '[model]',
      'command = "/nowhere/not-a-server"',
      '',
      '[mcp_servers.real]',
      'command = "/nowhere/real-server"',
      '',
      '[shell_environment_policy.set]',
      'command = "/nowhere/also-not-a-server"',
    ].join('\n'));
    const findings = await validateAgentSetup('codex', '/repo', home);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toBe('real → /nowhere/real-server');
  });

  test('says nothing about a command whose quoting never closed', async () => {
    const home = await codexHome('[mcp_servers.odd]\ncommand = "/nowhere/unclosed\n');

    expect(await validateAgentSetup('codex', '/repo', home)).toEqual([]);
  });

  test('treats any enabled value other than false as on', async () => {
    const home = await codexHome([
      '[mcp_servers.on]',
      'command = "/nowhere/on-server"',
      'enabled = true',
    ].join('\n'));

    expect(await validateAgentSetup('codex', '/repo', home)).toHaveLength(1);
  });
});
