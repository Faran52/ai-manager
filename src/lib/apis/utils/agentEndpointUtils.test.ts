import {
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
  vi,
} from 'vitest';

import {
  jsonOf,
  post,
  stubAgentEnv,
} from '@mocks/endpointRequestFixtures';

import { isAgentSetupResponse } from '../constants';

import {
  handleAgentInstall,
  handleAgentInstallCheck,
  handleAgentSetup,
  handlePluginAction,
  handlePluginCosts,
} from './agentEndpointUtils';

stubAgentEnv();

describe('handleAgentSetup', () => {
  test('reports every managed agent for a project', async () => {
    const project = await mkdtemp(join(tmpdir(), 'setup-endpoint-'));
    const home = await mkdtemp(join(tmpdir(), 'setup-home-'));

    await writeFile(join(project, 'AGENTS.md'), 'rules');

    const response = await handleAgentSetup(post({ projectPath: project }), { home });
    const body = await jsonOf(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      setups: [
        {
          agent: 'claude',
          mcpServers: [],
          rules: [],
        },
        {
          agent: 'codex',
          mcpServers: [],
          rules: [expect.objectContaining({
            path: join(project, 'AGENTS.md'),
            scope: 'project',
            bytes: 5,
          })],
        },
        {
          agent: 'copilot',
          mcpServers: [],
          rules: [],
        },
        {
          agent: 'cursor',
          mcpServers: [],
          rules: [expect.objectContaining({
            path: join(project, 'AGENTS.md'),
            scope: 'project',
            bytes: 5,
          })],
        },
        {
          agent: 'opencode',
          mcpServers: [],
          rules: [expect.objectContaining({
            path: join(project, 'AGENTS.md'),
            scope: 'project',
            bytes: 5,
          })],
        },
        {
          agent: 'gemini',
          mcpServers: [],
          rules: [],
        },
        {
          agent: 'antigravity',
          mcpServers: [],
          rules: [expect.objectContaining({
            path: join(project, 'AGENTS.md'),
            scope: 'project',
            bytes: 5,
          })],
        },
        {
          agent: 'cursor-agent',
          mcpServers: [],
          rules: [expect.objectContaining({
            path: join(project, 'AGENTS.md'),
            scope: 'project',
            bytes: 5,
          })],
        },
        {
          agent: 'grok',
          mcpServers: [],
          rules: [expect.objectContaining({
            path: join(project, 'AGENTS.md'),
            scope: 'project',
            bytes: 5,
          })],
        },
      ],
    });
  });

  test('rejects a body with no project path at all', async () => {
    expect((await handleAgentSetup(post({}))).status).toBe(400);
  });

  test('reads the machine-level half of every setup for an empty path', async () => {
    const home = await mkdtemp(join(tmpdir(), 'setup-global-'));

    await mkdir(join(home, '.codex'), { recursive: true });
    await writeFile(join(home, '.codex', 'AGENTS.md'), 'user rules');

    const response = await handleAgentSetup(post({ projectPath: '' }), { home });
    const body = await jsonOf(response);

    expect(response.status).toBe(200);
    // Trust and spend belong to one project, so the whole-machine read has neither.
    expect(body).toMatchObject({
      trust: {
        known: false,
        trusted: false,
        onboarded: false,
      },
      usage: null,
    });
    // The user half is read and not one project-scoped location is looked for.
    expect(JSON.stringify(body)).toContain('"scope":"user"');
    expect(JSON.stringify(body)).not.toContain('"scope":"project"');
  });
});

describe('handlePluginAction', () => {
  test('rejects a body that names no runnable action', async () => {
    expect((await handlePluginAction(post('"not an object"'))).status).toBe(400);
    expect((await handlePluginAction(post({}))).status).toBe(400);
    expect((await handlePluginAction(post({
      projectPath: '/projects/demo',
      plugin: 'a@b',
      scope: 'user',
      action: 'uninstall',
    }))).status).toBe(400);
  });

  test('runs the requested action through the claude cli', async () => {
    const run = vi.fn(() => {
      return Promise.resolve({
        ok: true,
        output: 'done',
      });
    });

    const response = await handlePluginAction(post({
      projectPath: '/projects/demo',
      plugin: 'code-review@claude-plugins-official',
      scope: 'user',
      action: 'disable',
    }), {
      home: '/home/x',
      pluginAction: run,
    });

    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith([
      'plugin',
      'disable',
      'code-review@claude-plugins-official',
      '-s',
      'user',
    ], { cwd: '/home/x' });
  });

  test('reports a refused action with the cli output', async () => {
    const run = vi.fn(() => {
      return Promise.resolve({
        ok: false,
        output: 'not installed',
      });
    });

    const response = await handlePluginAction(post({
      projectPath: '/projects/demo',
      plugin: 'a@b',
      scope: 'project',
      action: 'enable',
    }), { pluginAction: run });

    expect(response.status).toBe(502);
    expect(await response.text()).toContain('not installed');
  });

  test('falls back to a message when a refused action printed nothing', async () => {
    const run = vi.fn(() => {
      return Promise.resolve({
        ok: false,
        output: '',
      });
    });

    const response = await handlePluginAction(post({
      projectPath: '/projects/demo',
      plugin: 'a@b',
      scope: 'user',
      action: 'install',
    }), { pluginAction: run });

    expect(response.status).toBe(502);
    expect(await response.text()).toContain('The Claude CLI rejected the plugin action.');
  });

  test('rejects a malformed action body', async () => {
    const run = vi.fn(() => {
      return Promise.resolve({
        ok: true,
        output: '',
      });
    });

    expect((await handlePluginAction(post({}))).status).toBe(400);
    expect((await handlePluginAction(post({
      action: 'enable',
      plugin: 'a b',
      scope: 'user',
      projectPath: '/p',
    }))).status).toBe(400);
    expect((await handlePluginAction(post({
      action: 'reinstall',
      plugin: 'a@b',
      scope: 'user',
      projectPath: '/p',
    }))).status).toBe(400);
    expect((await handlePluginAction(post({
      action: 'enable',
      plugin: 'a@b',
      scope: 'local',
      projectPath: '/p',
    }))).status).toBe(400);
    expect((await handlePluginAction(post({
      action: 'enable',
      plugin: 'a@b',
      scope: 'user',
      projectPath: '',
    }))).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('handlePluginCosts', () => {
  test('attributes projected context cost to enabled plugins', async () => {
    const project = await mkdtemp(join(tmpdir(), 'plugin-cost-'));
    const home = await mkdtemp(join(tmpdir(), 'plugin-cost-home-'));

    await mkdir(join(home, '.claude', 'plugins'), { recursive: true });
    await writeFile(join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'x@m': [{
          scope: 'user',
          version: '1',
        }],
      },
    }));
    await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify({
      enabledPlugins: {
        'x@m': true,
      },
    }));

    const run = vi.fn(() => {
      return Promise.resolve({
        ok: true,
        output: 'Always-on:   ~449 tok   added to every session',
      });
    });

    const response = await handlePluginCosts(post({ projectPath: project }), {
      home,
      pluginDetails: run,
    });
    const body = await jsonOf(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      costs: [{
        plugin: 'x@m',
        alwaysOnTokens: 449,
        onInvokeTokens: 0,
        estimatedCostUsd: 0,
      }],
    });
    expect(run).toHaveBeenCalledWith(['plugin', 'details', 'x@m'], { cwd: home });
  });

  test('rejects a request without a project path', async () => {
    expect((await handlePluginCosts(post({}))).status).toBe(400);
    expect((await handlePluginCosts(post({ projectPath: '' }))).status).toBe(400);
  });
});

describe('handleAgentInstallCheck', () => {
  const EXPECTED_BODY = {
    agents: {
      crush: {
        installed: true,
        command: 'npm install -g @charmland/crush',
      },
      llm: {
        installed: false,
        command: 'pip install -U llm',
      },
    },
  };

  test('checks every installable agent and names its command, keyed by id', async () => {
    const resolve = vi.fn((bin: string) => {
      return Promise.resolve(bin === 'crush');
    });

    const response = await handleAgentInstallCheck({ agentInstallCheck: resolve });
    const body = await jsonOf(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject(EXPECTED_BODY);
    expect(resolve).toHaveBeenCalledWith('crush');
  });
});

describe('handleAgentInstall', () => {
  test('rejects a body naming no installable agent', async () => {
    expect((await handleAgentInstall(post('"not an object"'))).status).toBe(400);
    expect((await handleAgentInstall(post({}))).status).toBe(400);
    expect((await handleAgentInstall(post({ agent: 'kimi' }))).status).toBe(400);
  });

  test('runs the install command for a supported agent', async () => {
    const run = vi.fn(() => {
      return Promise.resolve({
        ok: true,
        output: 'added 1 package',
      });
    });

    const response = await handleAgentInstall(post({ agent: 'crush' }), { agentInstall: run });

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual({ ok: true });
    expect(run).toHaveBeenCalledWith('npm', ['install', '-g', '@charmland/crush']);
  });

  test('reports a failed install with its output', async () => {
    const run = vi.fn(() => {
      return Promise.resolve({
        ok: false,
        output: 'network error',
      });
    });

    const response = await handleAgentInstall(post({ agent: 'crush' }), { agentInstall: run });

    expect(response.status).toBe(502);
    expect(await response.text()).toContain('network error');
  });

  test('falls back to a message when a failed install printed nothing', async () => {
    const run = vi.fn(() => {
      return Promise.resolve({
        ok: false,
        output: '',
      });
    });

    const response = await handleAgentInstall(post({ agent: 'crush' }), { agentInstall: run });

    expect(response.status).toBe(502);
    expect(await response.text()).toContain('The install command failed.');
  });
});

describe('Claude profiles on the health endpoint', () => {
  test('reports one Claude setup per config dir', async () => {
    const project = await mkdtemp(join(tmpdir(), 'profile-project-'));
    const home = await mkdtemp(join(tmpdir(), 'profile-home-'));
    const personal = join(home, '.claude-personal');

    await mkdir(join(home, '.claude'), { recursive: true });
    await mkdir(personal, { recursive: true });
    await writeFile(join(personal, 'CLAUDE.md'), 'personal rules');

    const body = await jsonOf(await handleAgentSetup(post({ projectPath: project }), { home }));

    if (body == null || !isAgentSetupResponse(body)) {
      throw new Error('the agent setup read answered without setups');
    }

    const claude = body.setups.filter((setup) => {
      return setup.agent === 'claude';
    });

    expect(claude).toHaveLength(2);
    expect(claude[0]?.profile).toBeUndefined();
    expect(claude[1]).toMatchObject({
      profile: 'Personal',
      rules: [{ path: join(personal, 'CLAUDE.md') }],
    });
  });
});

describe('plugin endpoints for a Claude profile', () => {
  test('resolves the profile to its config dir for actions and costs', async () => {
    const home = await mkdtemp(join(tmpdir(), 'plugin-profile-'));
    const personal = join(home, '.claude-personal');

    await mkdir(join(home, '.claude'), { recursive: true });
    await mkdir(join(personal, 'plugins'), { recursive: true });
    await writeFile(join(personal, 'plugins', 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'mine@own': [{
          scope: 'user',
          version: '1.0.0',
        }],
      },
    }));
    await writeFile(join(personal, 'settings.json'), JSON.stringify({ enabledPlugins: { 'mine@own': true } }));

    const run = vi.fn(() => {
      return Promise.resolve({
        ok: true,
        output: 'Always-on context: ~1k tokens',
      });
    });

    expect((await handlePluginAction(post({
      projectPath: '/projects/demo',
      plugin: 'mine@own',
      scope: 'user',
      action: 'disable',
      profile: 'Personal',
    }), {
      home,
      pluginAction: run,
    })).status).toBe(200);
    expect(run).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ claudeDir: personal }));

    const details = vi.fn(() => {
      return Promise.resolve({
        ok: true,
        output: 'Always-on context: ~1k tokens',
      });
    });
    const costs = await jsonOf(await handlePluginCosts(post({
      projectPath: '/projects/demo',
      profile: 'Personal',
    }), {
      home,
      pluginDetails: details,
    }));

    expect(costs).toMatchObject({ costs: [{ plugin: 'mine@own' }] });
    expect(details).toHaveBeenCalledWith(
      ['plugin', 'details', 'mine@own'],
      expect.objectContaining({ claudeDir: personal }),
    );
  });
});
