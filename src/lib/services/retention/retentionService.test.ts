import {
  mkdir,
  mkdtemp,
  readFile,
  utimes,
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

import { resolveAgentPaths } from '../agents/agentsService';
import { createArchive } from '../archive/archiveService';

import {
  defaultRetentionPolicy,
  dueForArchive,
  readRetentionPolicy,
  runRetention,
  writeRetentionPolicy,
} from './retentionService';

import type { AgentRoots } from '../agents/agentsService';
import type { RetentionPolicy } from './retentionService';

const newHome = async (): Promise<string> => {
  const home = await mkdtemp(join(tmpdir(), 'retention-home-'));
  const projectDir = join(home, '.claude', 'projects', 'proj');

  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, 'old.jsonl'), JSON.stringify({
    type: 'user',
    uuid: 'u1',
    timestamp: '2026-01-01T00:00:00Z',
    message: {
      role: 'user',
      content: 'old session',
    },
  }), 'utf8');
  await utimes(join(projectDir, 'old.jsonl'), new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));

  return home;
};

const rootsFor = (home: string): AgentRoots => {
  return resolveAgentPaths({
    env: {},
    home,
  });
};

describe('retention policy', () => {
  test('uses the default for missing and malformed files', async () => {
    const home = await newHome();

    expect(await readRetentionPolicy(home)).toEqual(defaultRetentionPolicy);
    await mkdir(join(home, '.ai-chat-manager'), { recursive: true });
    await writeFile(join(home, '.ai-chat-manager', 'retention.json'), '{', 'utf8');

    expect(await readRetentionPolicy(home)).toEqual(defaultRetentionPolicy);
    await writeFile(join(home, '.ai-chat-manager', 'retention.json'), JSON.stringify({
      enabled: true,
      olderThanDays: 0,
      agents: [],
    }), 'utf8');

    expect(await readRetentionPolicy(home)).toEqual(defaultRetentionPolicy);
  });

  test('persists only valid policy values', async () => {
    const home = await newHome();
    const policy: RetentionPolicy = {
      enabled: true,
      olderThanDays: 14,
      agents: ['claude'],
    };

    await writeRetentionPolicy(policy, home);

    expect(await readRetentionPolicy(home)).toEqual(policy);
    expect(await readFile(join(home, '.ai-chat-manager', 'retention.json'), 'utf8')).toContain('14');
  });
});

describe('dueForArchive', () => {
  test('returns old unarchived sessions and excludes a copied session', async () => {
    const home = await newHome();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));

    const policy = {
      enabled: true,
      olderThanDays: 30,
      agents: [],
    };
    expect((await dueForArchive(rootsFor(home), policy, home)).sessions).toHaveLength(1);
    await createArchive(rootsFor(home), '', home);
    expect((await dueForArchive(rootsFor(home), policy, home)).sessions).toHaveLength(0);

    vi.useRealTimers();
  });

  test('skips sessions outside the selected agents and missing archive manifests', async () => {
    const home = await newHome();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    const manifest = await createArchive(rootsFor(home), '', home);

    await writeFile(join(home, '.ai-chat-manager', 'archives', manifest.id, 'manifest.json'), '{', 'utf8');

    expect((await dueForArchive(rootsFor(home), {
      enabled: true,
      olderThanDays: 30,
      agents: ['codex'],
    }, home)).sessions).toEqual([]);
    vi.useRealTimers();
  });
});

describe('runRetention', () => {
  test('does nothing while disabled and copies an eligible transcript when enabled', async () => {
    const home = await newHome();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));

    expect(await runRetention(rootsFor(home), home)).toEqual({
      archived: 0,
      archiveId: undefined,
    });
    await writeRetentionPolicy({
      enabled: true,
      olderThanDays: 30,
      agents: ['claude'],
    }, home);

    const result = await runRetention(rootsFor(home), home);

    vi.useRealTimers();

    expect(result.archived).toBe(1);
    expect(result.archiveId).toBeDefined();
    expect(await readFile(join(home, '.claude', 'projects', 'proj', 'old.jsonl'), 'utf8')).toContain('old session');
  });

  test('does not create an archive when no sessions are due', async () => {
    const home = await newHome();

    await writeRetentionPolicy({
      enabled: true,
      olderThanDays: 1,
      agents: ['codex'],
    }, home);

    expect(await runRetention(rootsFor(home), home)).toEqual({
      archived: 0,
      archiveId: undefined,
    });
  });
});
