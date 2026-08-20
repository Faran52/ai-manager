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

import {
  listSqliteProjects,
  listSqliteSessions,
  loadSqliteEntries,
} from './sqliteUtils';

const createDatabase = (filePath: string): void => {
  const database = new DatabaseSync(filePath);

  database.exec('CREATE TABLE messages (id TEXT, role TEXT, content TEXT, timestamp TEXT)');
  database.prepare('INSERT INTO messages VALUES (?, ?, ?, ?)')
    .run('u', 'user', 'Question', '2026-01-01T00:00:00Z');
  database.prepare('INSERT INTO messages VALUES (?, ?, ?, ?)')
    .run('a', 'assistant', 'Answer', '2026-01-01T00:00:01Z');
  database.exec('CREATE TABLE empty (value TEXT)');
  database.exec('CREATE TABLE state (key TEXT, value TEXT)');
  database.prepare('INSERT INTO state VALUES (?, ?)').run('chat', JSON.stringify({
    messages: [{
      role: 'user',
      content: 'Embedded question',
    }],
  }));
  database.close();
};

describe('SQLite history discovery', () => {
  test('discovers databases, exposes projects and sessions, and reloads entries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sqlite-history-'));
    const nested = join(root, 'nested');
    const filePath = join(nested, 'history.db');

    await mkdir(nested);
    createDatabase(filePath);
    await writeFile(join(root, 'skip.txt'), 'not a database');

    const projects = await listSqliteProjects('goose', [root, '/missing']);
    const sessions = await listSqliteSessions('goose', [root], nested);

    expect(projects).toMatchObject([{
      agent: 'goose',
      id: nested,
      sessionCount: 2,
      messageCount: 3,
    }]);
    expect(sessions).toHaveLength(2);
    const messages = sessions.find((session) => {
      return session.id.endsWith(':messages');
    });

    expect(await loadSqliteEntries(messages?.filePath ?? '', [filePath])).toMatchObject([
      { kind: 'user' },
      { kind: 'assistant' },
    ]);
    await expect(loadSqliteEntries('not-sqlite')).resolves.toBeUndefined();
    await expect(loadSqliteEntries('sqlite:bad')).resolves.toBeUndefined();
    await expect(loadSqliteEntries(`sqlite:${Buffer.from('{}').toString('base64url')}`)).resolves.toBeUndefined();
    await expect(loadSqliteEntries(`sqlite:${Buffer.from(JSON.stringify({
      databasePath: '/missing/database.db',
      table: 'messages',
    })).toString('base64url')}`)).resolves.toBeUndefined();
    await expect(loadSqliteEntries(`sqlite:${Buffer.from(JSON.stringify({
      databasePath: filePath,
      table: 'missing',
    })).toString('base64url')}`, [filePath])).resolves.toEqual([]);
    expect(await listSqliteSessions('goose', [root], '/other')).toEqual([]);
  });

  test('ignores malformed and unsupported database paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sqlite-bad-'));
    const invalid = join(root, 'broken.sqlite3');

    await writeFile(invalid, 'broken');

    expect(await listSqliteProjects('cursor', [invalid])).toEqual([]);
    expect(await listSqliteProjects('cursor', [join(root, 'plain.txt')])).toEqual([]);
  });

  test('stops deep traversal and ignores dependency metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sqlite-depth-'));
    let deep = root;

    for (let index = 0; index < 8; index += 1) {
      deep = join(deep, String(index));
      await mkdir(deep);
    }

    await mkdir(join(root, 'node_modules'));
    await mkdir(join(root, '.git'));
    createDatabase(join(deep, 'hidden.db'));

    expect(await listSqliteProjects('cursor', [root])).toEqual([]);
  });
});
