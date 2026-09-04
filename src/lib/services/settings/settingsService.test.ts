import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  editableSettingsAgents,
  projectScopedSettingsAgents,
  settingsAgents,
} from '@config/agents';

import {
  editableAgents,
  hasAgentSettings,
  isSettingsScope,
  projectScopedAgents,
  readAgentSettings,
  settingsSurfacesFor,
  surfacedAgents,
  writeScopeSettings,
} from './settingsService';

import type { ScopeSettings, SettingsPatch } from './settingsService';

const EMPTY_PATCH: SettingsPatch = {
  permissions: {
    allow: [],
    deny: [],
    ask: [],
    additionalDirectories: [],
  },
  env: [],
};

const claudeUser = async (project: string, home: string): Promise<ScopeSettings> => {
  const [scope] = await readAgentSettings('claude', project, home);

  // v8 ignore next -- Claude always has a user scope.
  if (scope == null) {
    throw new Error('no user scope');
  }

  return scope;
};

const newProject = async (): Promise<{
  readonly home: string;
  readonly project: string;
}> => {
  const home = await mkdtemp(join(tmpdir(), 'settings-home-'));
  const project = await mkdtemp(join(tmpdir(), 'settings-project-'));

  return {
    home,
    project,
  };
};

test('the project prompt is offered to exactly the agents that read one', () => {
  expect([...projectScopedAgents].sort((left, right) => {
    return left.localeCompare(right);
  })).toEqual([...projectScopedSettingsAgents].sort((left, right) => {
    return left.localeCompare(right);
  }));
});

test('the picker marks as writable exactly the agents SURFACES lets it write', () => {
  expect([...editableAgents].sort((left, right) => {
    return left.localeCompare(right);
  })).toEqual([...editableSettingsAgents].sort((left, right) => {
    return left.localeCompare(right);
  }));
});

test('the picker offers exactly the agents SURFACES covers', () => {
  // Two lists because the picker is client code and this module reads the
  // filesystem. They must name the same agents, or an agent gains a settings
  // page with no files behind it, or files with no way to reach them.
  expect([...surfacedAgents].sort((left, right) => {
    return left.localeCompare(right);
  })).toEqual([...settingsAgents].sort((left, right) => {
    return left.localeCompare(right);
  }));
});

describe('settingsSurfacesFor', () => {
  test('names the three files Claude Code merges', () => {
    expect(settingsSurfacesFor('claude', '/repo', '/home').map((surface) => {
      return surface.path;
    })).toEqual([
      '/home/.claude/settings.json',
      '/repo/.claude/settings.json',
      '/repo/.claude/settings.local.json',
    ]);
  });

  test('drops the project scopes when no project is open', () => {
    expect(settingsSurfacesFor('claude', '', '/home').map((surface) => {
      return surface.scope;
    })).toEqual(['user']);
  });

  test('marks every agent but Claude read-only, and names its format', () => {
    expect(settingsSurfacesFor('claude', '/repo', '/home').every((surface) => {
      return surface.editable && surface.format === 'json';
    })).toBe(true);
    expect(settingsSurfacesFor('codex', '/repo', '/home')).toEqual([{
      scope: 'user',
      format: 'toml',
      editable: false,
      path: '/home/.codex/config.toml',
    }]);
    expect(settingsSurfacesFor('gemini', '/repo', '/home').map((surface) => {
      return surface.editable;
    })).toEqual([false, false]);
  });

  test('names the file each remaining agent keeps', () => {
    expect(settingsSurfacesFor('opencode', '/repo', '/home').map((surface) => {
      return surface.path;
    })).toEqual(['/home/.config/opencode/opencode.json']);
    expect(settingsSurfacesFor('grok', '/repo', '/home').map((surface) => {
      return surface.path;
    })).toEqual(['/home/.grok/config.toml', '/repo/.grok/config.toml']);
  });

  test('offers nothing for an agent with no settings file of its own', () => {
    expect(hasAgentSettings('claude')).toBe(true);
    expect(hasAgentSettings('copilot')).toBe(false);
    expect(settingsSurfacesFor('copilot', '/repo', '/home')).toEqual([]);
    expect(surfacedAgents).toContain('claude');
    expect(surfacedAgents).not.toContain('copilot');
  });

  test('recognises only the three scopes', () => {
    expect(isSettingsScope('user')).toBe(true);
    expect(isSettingsScope('global')).toBe(false);
  });
});

describe('readAgentSettings', () => {
  test('reports a file that has never been written', async () => {
    const { home, project } = await newProject();
    const scope = await claudeUser(project, home);

    expect(scope.exists).toBe(false);
    expect(scope.readable).toBe(true);
    expect(scope.permissions.allow).toEqual([]);
    expect(scope.env).toEqual([]);
    expect(scope.preservedKeys).toEqual([]);
  });

  test('reads permissions, env and the keys it does not own', async () => {
    const { home, project } = await newProject();

    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify({
      permissions: {
        allow: ['Bash(ls:*)', 7],
        deny: ['Read(./secrets/**)'],
        ask: [],
        additionalDirectories: ['../shared'],
      },
      env: {
        ANTHROPIC_MODEL: 'opus',
        BROKEN: 3,
      },
      hooks: { Stop: [] },
      statusLine: { type: 'command' },
    }), 'utf8');

    const scope = await claudeUser(project, home);

    expect(scope.permissions.allow).toEqual(['Bash(ls:*)']);
    expect(scope.permissions.deny).toEqual(['Read(./secrets/**)']);
    expect(scope.permissions.additionalDirectories).toEqual(['../shared']);
    expect(scope.env).toEqual([{
      name: 'ANTHROPIC_MODEL',
      value: 'opus',
    }]);
    expect(scope.preservedKeys).toEqual(['hooks', 'statusLine']);
  });

  test('marks a file that is not valid JSON as unreadable', async () => {
    const { home, project } = await newProject();

    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(join(home, '.claude', 'settings.json'), '{ not json', 'utf8');

    const scope = await claudeUser(project, home);

    expect(scope.exists).toBe(true);
    expect(scope.readable).toBe(false);
  });

  test('treats a non-object and a missing permissions block as empty', async () => {
    const { home, project } = await newProject();

    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(join(home, '.claude', 'settings.json'), '[1, 2]', 'utf8');
    expect((await claudeUser(project, home)).readable).toBe(false);

    await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify({
      permissions: 'none',
      env: 'none',
    }), 'utf8');

    const scope = await claudeUser(project, home);

    expect(scope.permissions.allow).toEqual([]);
    expect(scope.env).toEqual([]);
  });
});

describe('readAgentSettings across agents', () => {
  test('returns three scopes with a project and one without', async () => {
    const { home, project } = await newProject();

    expect((await readAgentSettings('claude', project, home)).map((scope) => {
      return scope.scope;
    })).toEqual(['user', 'project', 'local']);
    expect((await readAgentSettings('claude', '', home)).map((scope) => {
      return scope.scope;
    })).toEqual(['user']);
  });

  test('names the sections and root keys a toml config holds', async () => {
    const { home, project } = await newProject();

    await mkdir(join(home, '.codex'), { recursive: true });
    await writeFile(join(home, '.codex', 'config.toml'), [
      '# a comment',
      '',
      'model = "gpt-5.4"',
      '[model_providers.openai]',
      'name = "OpenAI"',
      '[mcp_servers.webstorm]',
      'command = "/usr/local/bin/mcp"',
    ].join('\n'), 'utf8');

    const [scope] = await readAgentSettings('codex', project, home);

    expect(scope?.exists).toBe(true);
    expect(scope?.format).toBe('toml');
    expect(scope?.editable).toBe(false);
    /*
     * Only the outermost section name and the root keys above the first header,
     * so a table per provider or per server does not list one key each. A real
     * config listed sixty keys, most of them env vars nested inside
     * `[mcp_servers.<name>.env]`, for a file configuring thirteen areas.
     */
    expect(scope?.preservedKeys).toEqual([
      'model',
      'model_providers',
      'mcp_servers',
    ]);
  });

  test('skips a malformed toml line and unwraps an array of tables', async () => {
    const { home, project } = await newProject();

    await mkdir(join(home, '.codex'), { recursive: true });
    // The orphan sits above the first header, where root keys are read, so the
    // line without a name on its left is the one being skipped.
    await writeFile(join(home, '.codex', 'config.toml'), [
      '= orphaned',
      '[]',
      '[[profiles]]',
      'name = "one"',
    ].join('\n'), 'utf8');

    const [scope] = await readAgentSettings('codex', project, home);

    // `name` belongs to the `[[profiles]]` table, which is already named.
    expect(scope?.preservedKeys).toEqual(['profiles']);
  });

  test('reports a toml config that has never been written', async () => {
    const { home, project } = await newProject();
    const [scope] = await readAgentSettings('codex', project, home);

    expect(scope?.exists).toBe(false);
    expect(scope?.readable).toBe(true);
    expect(scope?.preservedKeys).toEqual([]);
  });

  test('reads a json config it may not write', async () => {
    const { home, project } = await newProject();

    await mkdir(join(home, '.gemini'), { recursive: true });
    await writeFile(join(home, '.gemini', 'settings.json'), JSON.stringify({
      theme: 'dark',
      selectedAuthType: 'oauth',
    }), 'utf8');

    const [scope] = await readAgentSettings('gemini', project, home);

    expect(scope?.exists).toBe(true);
    expect(scope?.editable).toBe(false);
    expect(scope?.preservedKeys).toEqual(['theme', 'selectedAuthType']);
  });

  test('refuses to write a surface whose schema is not Claude\'s', async () => {
    const { home, project } = await newProject();

    await expect(writeScopeSettings('user', project, EMPTY_PATCH, home, 'gemini'))
      .rejects.toThrow('read-only');
    await expect(writeScopeSettings('local', project, EMPTY_PATCH, home, 'codex'))
      .rejects.toThrow('no settings file for that scope');
  });
});

describe('writeScopeSettings', () => {
  test('writes permissions and env, and keeps the keys it does not own', async () => {
    const { home, project } = await newProject();

    await mkdir(join(project, '.claude'), { recursive: true });
    await writeFile(join(project, '.claude', 'settings.json'), JSON.stringify({
      hooks: { Stop: ['echo done'] },
      permissions: { allow: ['Bash(old:*)'] },
    }), 'utf8');

    const written = await writeScopeSettings('project', project, {
      permissions: {
        allow: ['  Bash(git status:*)  ', 'Bash(git status:*)', ''],
        deny: [],
        ask: ['Bash(rm:*)'],
        additionalDirectories: [],
      },
      env: [
        {
          name: '  ANTHROPIC_MODEL  ',
          value: 'opus',
        },
        {
          name: '   ',
          value: 'ignored',
        },
      ],
    }, home);

    expect(written.permissions.allow).toEqual(['Bash(git status:*)']);
    expect(written.permissions.ask).toEqual(['Bash(rm:*)']);
    expect(written.env).toEqual([{
      name: 'ANTHROPIC_MODEL',
      value: 'opus',
    }]);

    const raw = await readFile(join(project, '.claude', 'settings.json'), 'utf8');

    expect(raw).toContain('"hooks"');
    expect(raw.endsWith('\n')).toBe(true);
  });

  test('creates the folder and file for a scope that has none', async () => {
    const { home, project } = await newProject();
    const written = await writeScopeSettings('local', project, {
      ...EMPTY_PATCH,
      permissions: {
        ...EMPTY_PATCH.permissions,
        deny: ['Read(./.env)'],
      },
    }, home);

    expect(written.exists).toBe(true);
    expect(written.permissions.deny).toEqual(['Read(./.env)']);
  });

  test('drops both blocks when they are emptied', async () => {
    const { home, project } = await newProject();

    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify({
      permissions: { allow: ['Bash(ls:*)'] },
      env: { A: 'b' },
      model: 'opus',
    }), 'utf8');

    const written = await writeScopeSettings('user', project, EMPTY_PATCH, home);

    expect(written.permissions.allow).toEqual([]);
    expect(written.env).toEqual([]);
    expect(written.preservedKeys).toEqual(['model']);
  });

  test('refuses a project scope with no project and a file it cannot parse', async () => {
    const { home, project } = await newProject();

    await expect(writeScopeSettings('project', '', EMPTY_PATCH, home))
      .rejects.toThrow('Select a project');

    await mkdir(join(project, '.claude'), { recursive: true });
    await writeFile(join(project, '.claude', 'settings.json'), '{ broken', 'utf8');

    await expect(writeScopeSettings('project', project, EMPTY_PATCH, home))
      .rejects.toThrow('not valid JSON');
  });

  test('caps a runaway rule list and drops an overlong rule', async () => {
    const { home, project } = await newProject();
    const written = await writeScopeSettings('user', project, {
      ...EMPTY_PATCH,
      permissions: {
        ...EMPTY_PATCH.permissions,
        allow: [
          'x'.repeat(401),
          ...Array.from({ length: 600 }, (_, index) => {
            return `Bash(cmd${String(index)}:*)`;
          }),
        ],
      },
    }, home);

    expect(written.permissions.allow).toHaveLength(500);
    expect(written.permissions.allow).not.toContain('x'.repeat(401));
  });
});
