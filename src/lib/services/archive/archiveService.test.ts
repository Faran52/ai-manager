import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { resolveAgentPaths } from '../agents/agentsService';

import {
  archiveRoot,
  copySession,
  createArchive,
  deleteArchive,
  listArchives,
  readArchive,
} from './archiveService';

import type { AgentRoots } from '../agents/agentsService';
import type { RawHistoryLine } from '../history/utils/claudeRawUtils';

beforeEach(() => {
  vi.stubEnv('XDG_DATA_HOME', tmpdir());
  vi.stubEnv('XDG_CONFIG_HOME', tmpdir());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const LINES: readonly RawHistoryLine[] = [
  {
    type: 'user',
    uuid: 'u1',
    timestamp: '2026-06-01T10:00:00Z',
    message: {
      role: 'user',
      content: 'the question',
    },
  },
];

const newHome = async (): Promise<string> => {
  const home = await mkdtemp(join(tmpdir(), 'archive-home-'));
  const projectDir = join(home, '.claude', 'projects', 'proj');

  await mkdir(projectDir, { recursive: true });
  await writeFile(
    join(projectDir, 's.jsonl'),
    LINES.map((line) => {
      return JSON.stringify(line);
    }).join('\n'),
    'utf8',
  );

  return home;
};

// OpenCode keeps every session in one database, which is the shape the archive skips.
const addSharedDatabase = async (home: string): Promise<void> => {
  const dataDir = join(home, '.local', 'share', 'opencode', 'data');

  await mkdir(dataDir, { recursive: true });

  const database = new DatabaseSync(join(dataDir, 'opencode.db'));

  database.exec(`
    CREATE TABLE session (
      id TEXT PRIMARY KEY, title TEXT, directory TEXT, parent_id TEXT,
      time_created INTEGER, time_updated INTEGER
    );
    CREATE TABLE message (
      id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT
    );
    CREATE TABLE part (
      id TEXT PRIMARY KEY, message_id TEXT, session_id TEXT,
      time_created INTEGER, data TEXT
    );
  `);
  database.prepare(
    'INSERT INTO session (id, title, directory, parent_id, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ses_a', 'Session A', '/repo/alpha', null, 1_000, 2_000);
  database.prepare(
    'INSERT INTO message (id, session_id, time_created, data) VALUES (?, ?, ?, ?)',
  ).run('msg_1', 'ses_a', 1_000, JSON.stringify({ role: 'user' }));
  database.close();
};

const rootsFor = (home: string): AgentRoots => {
  return resolveAgentPaths({
    env: {},
    home,
  });
};

describe('createArchive', () => {
  test('falls back to the session id when a transcript names itself nothing', { timeout: 20_000 }, async () => {
    const home = await newHome();
    const projectDir = join(home, '.claude', 'projects', 'proj');

    await writeFile(
      join(projectDir, 'silent.jsonl'),
      JSON.stringify({
        type: 'assistant',
        uuid: 'a1',
        timestamp: '2026-06-01T10:00:00Z',
        message: {
          role: 'assistant',
          content: [{
            type: 'tool_use',
            id: 't1',
            name: 'Bash',
            input: { command: 'ls' },
          }],
        },
      }),
      'utf8',
    );

    const manifest = await createArchive(rootsFor(home), '', home);
    const silent = manifest.sessions.find((session) => {
      return session.archivePath.endsWith('silent.jsonl');
    });

    expect(silent?.title).toBe('silent');
  });

  test('copies every file-backed session and records a manifest', { timeout: 20_000 }, async () => {
    const home = await newHome();
    const manifest = await createArchive(rootsFor(home), 'before the upgrade', home);

    expect(manifest.note).toBe('before the upgrade');
    expect(manifest.sessions).toHaveLength(1);

    const session = manifest.sessions[0];

    expect(session?.projectId).toBe('proj');
    expect(session?.agent).toBe('claude');
    expect(await readFile(session?.archivePath ?? '', 'utf8')).toContain('the question');
  });

  test('trims an overlong note and leaves shared databases alone', { timeout: 20_000 }, async () => {
    const home = await newHome();

    await addSharedDatabase(home);

    const manifest = await createArchive(rootsFor(home), 'x'.repeat(400), home);

    expect(manifest.note).toHaveLength(200);
    expect(manifest.sessions.map((session) => {
      return session.agent;
    })).toEqual(['claude']);
  });

  test('drops a session whose destination cannot be written', { timeout: 20_000 }, async () => {
    const home = await newHome();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T00:00:00Z'));

    const first = await createArchive(rootsFor(home), '', home);
    const blocked = first.sessions[0]?.archivePath ?? '';

    await rm(blocked);
    await mkdir(join(blocked, 'occupied'), { recursive: true });

    const second = await createArchive(rootsFor(home), '', home);

    vi.useRealTimers();

    expect(second.id).toBe(first.id);
    expect(second.sessions).toEqual([]);
  });

  test('reports a session that vanished before it could be copied', async () => {
    const home = await mkdtemp(join(tmpdir(), 'archive-copy-'));

    expect(await copySession(join(home, 'missing.jsonl'), join(home, 'out', 'missing.jsonl'))).toBe(false);
    await writeFile(join(home, 'present.jsonl'), 'x', 'utf8');
    expect(await copySession(join(home, 'present.jsonl'), join(home, 'out', 'present.jsonl'))).toBe(true);
  });
});

describe('listArchives', () => {
  test('summarises newest first and ignores unreadable folders', { timeout: 20_000 }, async () => {
    const home = await newHome();
    const first = await createArchive(rootsFor(home), 'one', home);

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 60_000));

    const second = await createArchive(rootsFor(home), 'two', home);

    vi.useRealTimers();
    await mkdir(join(archiveRoot(home), 'not-an-archive'), { recursive: true });
    await writeFile(join(archiveRoot(home), 'not-an-archive', 'manifest.json'), 'nonsense', 'utf8');

    const archives = await listArchives(home);

    expect(archives.map((archive) => {
      return archive.id;
    })).toEqual([second.id, first.id]);
    expect(archives[0]?.sessionCount).toBe(1);
    expect(archives[0]?.agents).toEqual(['claude']);
    expect(archives[0]?.sizeBytes).toBeGreaterThan(0);
  });

  test('reports no archives when the folder has never been made', async () => {
    const home = await mkdtemp(join(tmpdir(), 'archive-empty-'));

    expect(await listArchives(home)).toEqual([]);
  });
});

describe('readArchive', () => {
  test('rejects an id that is not a plain folder name', async () => {
    const home = await newHome();

    expect(await readArchive('../secrets', home)).toBeUndefined();
    expect(await readArchive('missing', home)).toBeUndefined();
  });

  test('rejects a manifest whose sessions are the wrong shape', { timeout: 20_000 }, async () => {
    const home = await newHome();
    const target = join(archiveRoot(home), 'broken');

    await mkdir(target, { recursive: true });
    await writeFile(
      join(target, 'manifest.json'),
      JSON.stringify({
        id: 'broken',
        createdMs: 1,
        note: '',
        skippedAgents: [],
        sessions: [{ agent: 'nope' }],
      }),
      'utf8',
    );

    expect(await readArchive('broken', home)).toBeUndefined();
  });
});

describe('deleteArchive', () => {
  test('removes an archive and refuses an unsafe id', { timeout: 20_000 }, async () => {
    const home = await newHome();
    const manifest = await createArchive(rootsFor(home), '', home);

    await deleteArchive(manifest.id, home);

    expect(await readdir(archiveRoot(home))).toEqual([]);
    await expect(deleteArchive('../..', home)).rejects.toThrow('Unknown archive');
  });
});
