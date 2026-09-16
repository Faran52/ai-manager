import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  jsonOf,
  post,
  stubAgentEnv,
} from '@mocks/endpointRequestFixtures';

import { handleReadSettings, handleWriteSettings } from './settingsEndpointUtils';

stubAgentEnv();

describe('settings endpoints', () => {
  const emptyPatch = {
    permissions: {
      allow: [],
      deny: [],
      ask: [],
      additionalDirectories: [],
    },
    env: [],
  };

  test('reads every scope and writes one back', async () => {
    const home = await mkdtemp(join(tmpdir(), 'settings-api-home-'));
    const project = await mkdtemp(join(tmpdir(), 'settings-api-project-'));

    expect(await jsonOf(await handleReadSettings(post({ projectPath: project }), { home })))
      .toMatchObject({ scopes: [{ scope: 'user' }, { scope: 'project' }, { scope: 'local' }] });

    expect(await jsonOf(await handleReadSettings(post({
      projectPath: project,
      agent: 'codex',
    }), { home }))).toMatchObject({ scopes: [{ editable: false }] });
    expect((await handleReadSettings(post({
      projectPath: project,
      agent: 'nonsense',
    }), { home })).status).toBe(400);

    const written = await handleWriteSettings(post({
      projectPath: project,
      scope: 'project',
      patch: {
        ...emptyPatch,
        permissions: {
          ...emptyPatch.permissions,
          allow: ['Bash(ls:*)'],
        },
        env: [{
          name: 'A',
          value: 'b',
        }],
      },
    }), { home });

    expect(written.status).toBe(200);
    expect(await jsonOf(written)).toMatchObject({
      scope: {
        scope: 'project',
        exists: true,
        permissions: { allow: ['Bash(ls:*)'] },
      },
    });
  });

  test('rejects malformed settings requests', async () => {
    const home = await mkdtemp(join(tmpdir(), 'settings-api-bad-'));

    expect((await handleReadSettings(post({}), { home })).status).toBe(400);
    expect((await handleReadSettings(post('nonsense'), { home })).status).toBe(400);
    expect((await handleWriteSettings(post('nonsense'), { home })).status).toBe(400);
    expect((await handleWriteSettings(post({
      projectPath: '/repo',
      scope: 'global',
      patch: emptyPatch,
    }), { home })).status).toBe(400);
    expect((await handleWriteSettings(post({
      projectPath: '/repo',
      scope: 'user',
      patch: { env: [] },
    }), { home })).status).toBe(400);
    expect((await handleWriteSettings(post({
      projectPath: '/repo',
      scope: 'user',
      patch: {
        permissions: {
          allow: [7],
          deny: [],
          ask: [],
          additionalDirectories: [],
        },
        env: [],
      },
    }), { home })).status).toBe(400);
    expect((await handleWriteSettings(post({
      projectPath: '/repo',
      scope: 'user',
      patch: {
        ...emptyPatch,
        env: [{ name: 'A' }],
      },
    }), { home })).status).toBe(400);
    expect((await handleWriteSettings(post({
      projectPath: '/repo',
      scope: 'user',
      patch: 'nope',
    }), { home })).status).toBe(400);
  });

  test('refuses a project write that names no project', async () => {
    const home = await mkdtemp(join(tmpdir(), 'settings-api-noproject-'));

    expect((await handleWriteSettings(post({
      projectPath: '',
      scope: 'project',
      patch: emptyPatch,
    }), { home })).status).toBe(400);
  });
});

describe('Claude profiles on the settings endpoint', () => {
  test('reads a named profile config dir, and refuses a profile that is not text', async () => {
    const project = await mkdtemp(join(tmpdir(), 'profile-project-'));
    const home = await mkdtemp(join(tmpdir(), 'profile-home-'));
    const personal = join(home, '.claude-personal');

    await mkdir(join(home, '.claude'), { recursive: true });
    await mkdir(personal, { recursive: true });

    const scopes = (await jsonOf(await handleReadSettings(post({
      projectPath: project,
      profile: 'Personal',
    }), { home }))) as { scopes: readonly { path: string }[] };

    expect(scopes.scopes[0]?.path).toBe(join(personal, 'settings.json'));
    expect((await handleReadSettings(post({
      projectPath: project,
      profile: 7,
    }), { home })).status).toBe(400);
  });
});
