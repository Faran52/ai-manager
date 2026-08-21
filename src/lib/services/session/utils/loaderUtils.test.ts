import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  describe,
  expect,
  test,
} from 'vitest';

import { listOpenCodeSessions } from '../../history/utils/openCodeUtils';
import { listSqliteSessions } from '../../history/utils/sqliteUtils';

import { loadSessionEntriesOrEmpty, loadSessionPage } from './loaderUtils';

import type { RawHistoryLine } from '../../history/utils/claudeRawUtils';

const claudeDir = async (): Promise<string> => {
  return mkdtemp(join(tmpdir(), 'loader-'));
};

const rootsFor = (dir: string): readonly string[] => {
  return [dir];
};

const writeSession = async (
  dir: string,
  projectId: string,
  fileName: string,
  lines: readonly (RawHistoryLine | string)[],
): Promise<string> => {
  const projectDir = join(dir, 'projects', projectId);

  await mkdir(projectDir, { recursive: true });
  const filePath = join(projectDir, fileName);

  await writeFile(filePath, lines.map((entry) => {
    return JSON.stringify(entry);
  }).join('\n'), 'utf8');

  return filePath;
};

const userLine = (text: string, sidechain = false): RawHistoryLine => {
  return {
    type: 'user',
    uuid: `u-${text}`,
    timestamp: '2026-01-01T10:00:00Z',
    isSidechain: sidechain,
    message: {
      role: 'user',
      content: text,
    },
  };
};

describe('loadSessionEntriesOrEmpty', () => {
  test('returns nothing for a missing file', async () => {
    await expect(
      loadSessionEntriesOrEmpty('/nonexistent/session.jsonl', 'claude', rootsFor('/tmp')),
    ).resolves.toEqual([]);
  });

  test('loads and caches Codex entries', async () => {
    const dir = await claudeDir();
    const filePath = join(dir, 'rollout.jsonl');
    const content = [
      JSON.stringify({
        type: 'session_meta',
        timestamp: '2026-01-01T00:00:00Z',
        payload: {
          id: 'c',
          cwd: '/repo',
        },
      }),
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-01-01T00:00:00Z',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ text: 'Codex message' }],
        },
      }),
    ].join('\n');

    await writeFile(filePath, content);
    expect(await loadSessionEntriesOrEmpty(filePath, 'codex', rootsFor(dir))).toHaveLength(1);
    expect(await loadSessionEntriesOrEmpty(filePath, 'codex', rootsFor(dir))).toHaveLength(1);
  });

  test('returns every parsable entry in file order', async () => {
    const dir = await claudeDir();
    const filePath = await writeSession(dir, 'p1', 's1.jsonl', [
      {
        type: 'mode',
        mode: 'normal',
      },
      userLine('hello'),
      {
        type: 'assistant',
        uuid: 'a1',
        timestamp: '2026-01-01T10:00:05Z',
        message: {
          role: 'assistant',
          content: [{
            type: 'text',
            text: 'hi',
          }],
        },
      },
      'not json',
    ]);

    const entries = await loadSessionEntriesOrEmpty(filePath, 'claude', rootsFor(dir));

    expect(entries.map((entry) => {
      return entry.kind;
    })).toEqual(['user', 'assistant']);
  });

  test('treats an unreadable file as empty', async () => {
    const dir = await claudeDir();
    const projectDir = join(dir, 'projects', 'p2');

    await mkdir(projectDir, { recursive: true });
    const filePath = join(projectDir, 'blocked.jsonl');

    await mkdir(filePath);

    await expect(loadSessionEntriesOrEmpty(filePath, 'claude', rootsFor(dir))).resolves.toEqual([]);
  });

  test('re-reads a file whose size changed', async () => {
    const dir = await claudeDir();
    const filePath = await writeSession(dir, 'p3', 's3.jsonl', [userLine('first')]);

    await expect(loadSessionEntriesOrEmpty(filePath, 'claude', rootsFor(dir))).resolves.toHaveLength(1);
    await writeFile(filePath, `${JSON.stringify(userLine('second'))}\n`, 'utf8');
    const reloaded = await loadSessionEntriesOrEmpty(filePath, 'claude', rootsFor(dir));

    expect(reloaded.some((entry) => {
      return entry.kind === 'user' && entry.text === 'second';
    })).toBe(true);
  });
});

describe('loadSessionPage', () => {
  test('paginates with totals and continuation flags', async () => {
    const dir = await claudeDir();
    const filePath = await writeSession(dir, 'p4', 's4.jsonl', [
      userLine('one'),
      userLine('two'),
      userLine('three'),
      userLine('four'),
    ]);

    const roots = rootsFor(dir);
    const middle = await loadSessionPage(filePath, {
      offset: 1,
      limit: 2,
      includeSidechain: false,
    }, 'claude', roots);

    expect(middle).toMatchObject({
      total: 4,
      hasMore: true,
      nextOffset: 3,
    });
    expect(middle?.entries.map((entry) => {
      return entry.kind === 'user' ? entry.text : '';
    })).toEqual(['two', 'three']);

    const last = await loadSessionPage(filePath, {
      offset: 3,
      limit: 5,
      includeSidechain: false,
    }, 'claude', roots);

    expect(last).toMatchObject({
      hasMore: false,
      nextOffset: 4,
    });

    const beyond = await loadSessionPage(filePath, {
      offset: 99,
      limit: 5,
      includeSidechain: false,
    }, 'claude', roots);

    expect(beyond).toMatchObject({
      entries: [],
      total: 4,
      hasMore: false,
      nextOffset: 4,
    });
  });

  test('filters sidechain turns while keeping summaries', async () => {
    const dir = await claudeDir();
    const filePath = await writeSession(dir, 'p5', 's5.jsonl', [
      userLine('main'),
      userLine('agent thought', true),
      {
        type: 'summary',
        summary: 'recap',
      },
    ]);

    const roots = rootsFor(dir);
    const request = {
      offset: 0,
      limit: 10,
      includeSidechain: false,
    };
    const filtered = await loadSessionPage(filePath, request, 'claude', roots);

    expect(filtered?.total).toBe(2);

    const everything = await loadSessionPage(
      filePath,
      {
        ...request,
        includeSidechain: true,
      },
      'claude',
      roots,
    );

    expect(everything?.total).toBe(3);
  });

  test('returns nothing for a missing file', async () => {
    await expect(loadSessionPage(
      '/nonexistent/x.jsonl',
      {
        offset: 0,
        limit: 1,
        includeSidechain: false,
      },
      'claude',
      rootsFor('/tmp'),
    )).resolves.toBeUndefined();
  });
});

test('loads a virtual SQLite session page', async () => {
  const root = await claudeDir();
  const filePath = join(root, 'history.db');
  const database = new DatabaseSync(filePath);

  database.exec('CREATE TABLE messages (role TEXT, content TEXT)');
  database.prepare('INSERT INTO messages VALUES (?, ?)').run('user', 'Question');
  database.close();

  const sessions = await listSqliteSessions('goose', [filePath], root);
  const page = await loadSessionPage(
    sessions[0]?.filePath ?? '',
    {
      offset: 0,
      limit: 5,
      includeSidechain: false,
    },
    'goose',
    [filePath],
  );

  expect(page).toMatchObject({
    messageCount: 1,
    total: 1,
  });
});

test('loads a virtual OpenCode session page from its synthetic reference', async () => {
  const root = await claudeDir();
  const filePath = join(root, 'opencode.db');
  const database = new DatabaseSync(filePath);

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
  ).run('ses_1', null, root, null, 1_000, 2_000);
  database.prepare(
    'INSERT INTO message (id, session_id, time_created, data) VALUES (?, ?, ?, ?)',
  ).run('msg_1', 'ses_1', 1_000, JSON.stringify({ role: 'user' }));
  database.prepare(
    'INSERT INTO part (id, message_id, session_id, time_created, data) VALUES (?, ?, ?, ?, ?)',
  ).run('part_1', 'msg_1', 'ses_1', 1_000, JSON.stringify({
    type: 'text',
    text: 'Open it',
  }));
  database.close();

  const sessions = await listOpenCodeSessions('opencode', [root]);
  const page = await loadSessionPage(
    sessions[0]?.filePath ?? '',
    {
      offset: 0,
      limit: 5,
      includeSidechain: false,
    },
    'opencode',
    [root],
  );

  expect(sessions[0]?.title).toBe('Open it');
  expect(page).toMatchObject({
    messageCount: 1,
    total: 1,
  });
});
