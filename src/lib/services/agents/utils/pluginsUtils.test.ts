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
} from 'vitest';

import { readClaudePlugins } from './pluginsUtils';

interface Workspace {
  home: string;
  project: string;
}

const workspace = async (): Promise<Workspace> => {
  const root = await mkdtemp(join(tmpdir(), 'plugins-'));
  const home = join(root, 'home');
  const project = join(root, 'project');

  await mkdir(join(home, '.claude', 'plugins'), { recursive: true });
  await mkdir(join(project, '.claude'), { recursive: true });

  return {
    home,
    project,
  };
};

const write = async (file: string, value: object): Promise<void> => {
  await writeFile(file, JSON.stringify(value));
};

describe('readClaudePlugins', () => {
  const EXPECTED_PLUGINS = [
    {
      id: 'review@official',
      marketplace: 'official',
      scope: 'user',
      enabled: true,
      version: '1.2.0',
      knownMarketplace: true,
    },
    {
      id: 'sleeping@official',
      marketplace: 'official',
      scope: 'user',
      enabled: false,
      version: 'unknown',
      knownMarketplace: true,
    },
  ];

  test('reports what applies here, and whether it is switched on', async () => {
    const { home, project } = await workspace();

    await write(join(home, '.claude', 'plugins', 'installed_plugins.json'), {
      version: 2,
      plugins: {
        'review@official': [{
          scope: 'user',
          version: '1.2.0',
        }],
        'sleeping@official': [{
          scope: 'user',
          version: 'unknown',
        }],
        'elsewhere@official': [{
          scope: 'project',
          projectPath: '/another/repo',
        }],
      },
    });
    await write(join(home, '.claude', 'plugins', 'known_marketplaces.json'), { official: {} });
    await write(join(home, '.claude', 'settings.json'), { enabledPlugins: { 'review@official': true } });

    expect(await readClaudePlugins(project, home)).toEqual(EXPECTED_PLUGINS);
  });

  test('prefers this project’s install over the user-wide one', async () => {
    const { home, project } = await workspace();

    await write(join(home, '.claude', 'plugins', 'installed_plugins.json'), {
      plugins: {
        'shared@official': [
          {
            scope: 'user',
            version: '1.0.0',
          },
          {
            scope: 'project',
            projectPath: project,
            version: '2.0.0',
          },
        ],
      },
    });

    expect(await readClaudePlugins(project, home)).toEqual([
      expect.objectContaining({
        scope: 'project',
        version: '2.0.0',
      }),
    ]);
  });

  test('lets a project switch on a plugin the user has not', async () => {
    const { home, project } = await workspace();

    await write(join(home, '.claude', 'plugins', 'installed_plugins.json'), {
      plugins: { 'local@official': [{ scope: 'user' }] },
    });
    await write(join(project, '.claude', 'settings.json'), {
      enabledPlugins: { 'local@official': true },
    });

    expect(await readClaudePlugins(project, home)).toEqual([
      expect.objectContaining({
        id: 'local@official',
        enabled: true,
      }),
    ]);
  });

  test('marks a plugin whose marketplace this machine does not know', async () => {
    const { home, project } = await workspace();

    await write(join(home, '.claude', 'plugins', 'installed_plugins.json'), {
      plugins: { 'orphan@vanished': [{ scope: 'user' }] },
    });

    expect(await readClaudePlugins(project, home)).toEqual([
      expect.objectContaining({
        id: 'orphan@vanished',
        knownMarketplace: false,
      }),
    ]);
  });

  test('reads past entries that are not shaped like installs', async () => {
    const { home, project } = await workspace();

    await write(join(home, '.claude', 'plugins', 'installed_plugins.json'), {
      plugins: {
        'no-suffix': [{ scope: 'user' }],
        'not-a-list@official': 'text',
        'wrong-entries@official': [42],
        'other-project-only@official': [{
          scope: 'project',
          projectPath: '/elsewhere',
        }],
      },
    });

    expect(await readClaudePlugins(project, home)).toEqual([]);
  });

  test('reports nothing when no plugins are installed', async () => {
    const { home, project } = await workspace();

    expect(await readClaudePlugins(project, home)).toEqual([]);
  });
});

describe('readClaudePlugins for a sibling profile', () => {
  test('reads the registry files from that config dir', async () => {
    const { home, project } = await workspace();
    const personal = join(home, '.claude-personal');

    await mkdir(join(personal, 'plugins'), { recursive: true });
    await write(join(personal, 'plugins', 'installed_plugins.json'), {
      version: 2,
      plugins: {
        'mine@own': [{
          scope: 'user',
          version: '1.0.0',
        }],
      },
    });
    await write(join(personal, 'plugins', 'known_marketplaces.json'), { own: {} });
    await write(join(personal, 'settings.json'), { enabledPlugins: { 'mine@own': true } });

    expect(await readClaudePlugins(project, home, personal)).toEqual([
      expect.objectContaining({
        id: 'mine@own',
        enabled: true,
        knownMarketplace: true,
      }),
    ]);
  });
});
