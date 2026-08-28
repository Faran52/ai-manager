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
  isSettingsScope,
  readScopeSettings,
  readSettings,
  settingsPathFor,
  writeScopeSettings,
} from './settingsService';

import type { SettingsPatch } from './settingsService';

const EMPTY_PATCH: SettingsPatch = {
  permissions: {
    allow: [],
    deny: [],
    ask: [],
    additionalDirectories: [],
  },
  env: [],
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

describe('settingsPathFor', () => {
  test('names the three files Claude Code merges', () => {
    expect(settingsPathFor('user', '/repo', '/home')).toBe('/home/.claude/settings.json');
    expect(settingsPathFor('project', '/repo', '/home')).toBe('/repo/.claude/settings.json');
    expect(settingsPathFor('local', '/repo', '/home')).toBe('/repo/.claude/settings.local.json');
  });

  test('recognises only the three scopes', () => {
    expect(isSettingsScope('user')).toBe(true);
    expect(isSettingsScope('global')).toBe(false);
  });
});

describe('readScopeSettings', () => {
  test('reports a file that has never been written', async () => {
    const { home, project } = await newProject();
    const scope = await readScopeSettings('user', project, home);

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

    const scope = await readScopeSettings('user', project, home);

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

    const scope = await readScopeSettings('user', project, home);

    expect(scope.exists).toBe(true);
    expect(scope.readable).toBe(false);
  });

  test('treats a non-object and a missing permissions block as empty', async () => {
    const { home, project } = await newProject();

    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(join(home, '.claude', 'settings.json'), '[1, 2]', 'utf8');
    expect((await readScopeSettings('user', project, home)).readable).toBe(false);

    await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify({
      permissions: 'none',
      env: 'none',
    }), 'utf8');

    const scope = await readScopeSettings('user', project, home);

    expect(scope.permissions.allow).toEqual([]);
    expect(scope.env).toEqual([]);
  });
});

describe('readSettings', () => {
  test('returns three scopes with a project and one without', async () => {
    const { home, project } = await newProject();

    expect((await readSettings(project, home)).map((scope) => {
      return scope.scope;
    })).toEqual(['user', 'project', 'local']);
    expect((await readSettings('', home)).map((scope) => {
      return scope.scope;
    })).toEqual(['user']);
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
