import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { zstdCompressSync } from 'node:zlib';

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
    for (const decoder of ['cursor', 'goose', 'zed']) {
      await expect(loadSqliteEntries(`sqlite:${Buffer.from(JSON.stringify({
        databasePath: filePath,
        decoder,
        sessionId: 'missing',
        table: 'missing',
      })).toString('base64url')}`, [filePath])).resolves.toBeUndefined();
    }
    expect(await listSqliteSessions('goose', [root], '/other')).toEqual([]);
    expect(await listSqliteSessions('zed', [root])).toHaveLength(2);
  });

  test('decodes Cursor composers instead of exposing key-value tables', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cursor-history-'));
    const filePath = join(root, 'state.vscdb');
    const database = new DatabaseSync(filePath);

    database.exec(`
      CREATE TABLE cursorDiskKV (key TEXT UNIQUE, value BLOB);
      CREATE TABLE ItemTable (key TEXT UNIQUE, value BLOB);
    `);
    const metadata = {
      composerId: 'composer-1',
      createdAt: 1_767_225_600_000,
      modelConfig: { modelName: 'cursor-model' },
      fullConversationHeadersOnly: [
        {
          bubbleId: 'u1',
          type: 1,
        },
        {
          bubbleId: 'a1',
          type: 2,
        },
      ],
    };
    database.prepare('INSERT INTO ItemTable VALUES (?, ?)').run('composer.composerHeaders', JSON.stringify({
      allComposers: [
        null,
        {},
        {
          composerId: 'composer-1',
          name: 'Cursor session',
          workspaceIdentifier: { uri: { fsPath: '/repo/cursor' } },
        },
      ],
    }));
    database.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)')
      .run('composerData:composer-1', Buffer.from(JSON.stringify(metadata)));
    database.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)')
      .run('bubbleId:composer-1:u1', Buffer.from(JSON.stringify({
        type: 1,
        text: 'Question\n<environment_context>hidden</environment_context>',
        createdAt: 1_767_225_600_000,
      })));
    database.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)')
      .run('bubbleId:composer-1:a1', Buffer.from(JSON.stringify({
        type: 2,
        text: 'Answer',
        createdAt: 1_767_225_601_000,
        allThinkingBlocks: ['Reasoning'],
      })));
    database.close();

    const sessions = await listSqliteSessions('cursor', [filePath]);
    const entries = await loadSqliteEntries(sessions[0]?.filePath ?? '', [filePath]);

    expect(sessions).toMatchObject([{
      actualSessionId: 'composer-1',
      title: 'Cursor session',
      projectId: '/repo/cursor',
      messageCount: 2,
    }]);
    expect(entries).toMatchObject([
      {
        kind: 'user',
        text: 'Question',
        injectedText: '<environment_context>hidden</environment_context>',
      },
      {
        kind: 'assistant',
        model: 'cursor-model',
        blocks: [
          {
            blockType: 'thinking',
            thinking: 'Reasoning',
          },
          {
            blockType: 'text',
            text: 'Answer',
          },
        ],
      },
    ]);
  });

  test('handles legacy, incomplete, and malformed Cursor records', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cursor-legacy-'));
    const filePath = join(root, 'state.vscdb');
    const database = new DatabaseSync(filePath);

    database.exec(`
      CREATE TABLE cursorDiskKV (key TEXT UNIQUE, value BLOB);
      CREATE TABLE ItemTable (key TEXT UNIQUE, value BLOB);
    `);
    database.prepare('INSERT INTO ItemTable VALUES (?, ?)').run('composer.composerHeaders', 'null');
    database.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)').run('composerData:legacy', JSON.stringify({
      fullConversationHeadersOnly: [
        null,
        {},
        { bubbleId: 'missing' },
        {
          bubbleId: 'unsupported',
          type: 3,
        },
        {
          bubbleId: 'empty',
          type: 2,
        },
        {
          bubbleId: 'user',
          type: 1,
        },
        {
          bubbleId: 'thinking',
          type: 2,
        },
      ],
      conversationMap: {
        unsupported: { text: 'ignored' },
        empty: {},
        user: { text: 'Legacy question' },
        thinking: {
          allThinkingBlocks: [null, '', 3, { text: 'Legacy thought' }, { text: 4 }],
        },
      },
    }));
    database.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)')
      .run('composerData:no-headers', JSON.stringify({ fullConversationHeadersOnly: 'bad' }));
    database.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)')
      .run('composerData:no-bubbles', JSON.stringify({
        fullConversationHeadersOnly: [{
          bubbleId: 'absent',
          type: 1,
        }],
      }));
    database.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)').run('bubbleId:legacy:bad', '[1]');
    database.close();

    const sessions = await listSqliteSessions('cursor', [filePath]);

    expect(sessions).toMatchObject([{
      actualSessionId: 'legacy',
      projectId: root,
      title: undefined,
      messageCount: 1,
    }]);
    expect(await loadSqliteEntries(sessions[0]?.filePath ?? '', [filePath])).toMatchObject([
      {
        kind: 'user',
        text: 'Legacy question',
      },
      {
        kind: 'assistant',
        blocks: [{
          blockType: 'thinking',
          thinking: 'Legacy thought',
        }],
      },
    ]);
  });

  test('accepts Cursor stores before the global header index exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cursor-no-index-'));
    const withoutTable = join(root, 'without-table.vscdb');
    const withoutRow = join(root, 'without-row.vscdb');
    const first = new DatabaseSync(withoutTable);
    const second = new DatabaseSync(withoutRow);

    first.exec('CREATE TABLE cursorDiskKV (key TEXT UNIQUE, value BLOB)');
    second.exec(`
      CREATE TABLE cursorDiskKV (key TEXT UNIQUE, value BLOB);
      CREATE TABLE ItemTable (key TEXT UNIQUE, value BLOB);
    `);
    first.close();
    second.close();

    expect(await listSqliteSessions('cursor', [withoutTable])).toEqual([]);
    expect(await listSqliteSessions('cursor', [withoutRow])).toEqual([]);
  });

  test('decodes Goose sessions and messages as one semantic session', async () => {
    const root = await mkdtemp(join(tmpdir(), 'goose-history-'));
    const filePath = join(root, 'sessions.db');
    const database = new DatabaseSync(filePath);

    database.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY, name TEXT, working_dir TEXT,
        created_at TEXT, updated_at TEXT
      );
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY, session_id TEXT, role TEXT,
        content_json TEXT, created_timestamp INTEGER
      );
    `);
    database.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?)')
      .run('goose-1', 'Goose session', '/repo/goose', '2026-01-01', '2026-01-01');
    database.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?)')
      .run(1, 'goose-1', 'user', JSON.stringify([{
        type: 'text',
        text: 'Question',
      }]), 1_767_225_600);
    database.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?)')
      .run(2, 'goose-1', 'assistant', JSON.stringify([{
        type: 'text',
        text: 'Answer',
      }]), 1_767_225_601);
    database.close();

    const sessions = await listSqliteSessions('goose', [filePath]);
    const entries = await loadSqliteEntries(sessions[0]?.filePath ?? '', [filePath]);

    expect(sessions).toMatchObject([{
      actualSessionId: 'goose-1',
      title: 'Goose session',
      projectId: '/repo/goose',
      messageCount: 2,
    }]);
    expect(entries).toMatchObject([
      {
        kind: 'user',
        text: 'Question',
      },
      {
        kind: 'assistant',
        blocks: [{
          blockType: 'text',
          text: 'Answer',
        }],
      },
    ]);
  });

  test('skips empty Goose sessions and tolerates missing message fields', async () => {
    const root = await mkdtemp(join(tmpdir(), 'goose-incomplete-'));
    const filePath = join(root, 'sessions.db');
    const database = new DatabaseSync(filePath);

    database.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY, name TEXT, working_dir TEXT,
        created_at TEXT, updated_at TEXT
      );
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY, session_id TEXT, role TEXT,
        content_json TEXT, created_timestamp TEXT
      );
    `);
    database.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?)')
      .run('', '', '', '', '');
    database.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?)')
      .run('empty', '', '', '', '');
    database.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?)')
      .run(1, 'empty', 'user', 'null', 'not-a-time');
    database.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?)')
      .run('fallbacks', '', '', '', '');
    database.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?)')
      .run(2, 'fallbacks', Buffer.from('user'), JSON.stringify([{ text: 'Question' }]), 'not-a-time');
    database.close();

    const sessions = await listSqliteSessions('goose', [filePath]);

    expect(sessions).toMatchObject([{
      actualSessionId: 'fallbacks',
      title: undefined,
      cwd: 'unknown',
      messageCount: 1,
    }]);
  });

  test('decodes JSON and zstd Zed thread blobs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'zed-history-'));
    const filePath = join(root, 'threads.db');
    const database = new DatabaseSync(filePath);
    const content = JSON.stringify({
      messages: [
        {
          id: 'u',
          role: 'user',
          content: 'Question',
        },
        {
          id: 'a',
          role: 'assistant',
          content: 'Answer',
        },
      ],
    });

    database.exec(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY, summary TEXT, updated_at TEXT,
        data_type, data BLOB
      )
    `);
    database.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?)')
      .run('zed-json', 'JSON thread', '2026-01-01T00:00:00Z', 'json', Buffer.from(content));
    database.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?)')
      .run('zed-zstd', 'Zstd thread', '2026-01-02T00:00:00Z', 'zstd', zstdCompressSync(content));
    database.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?)')
      .run('zed-bad', 'Bad thread', '2026-01-03T00:00:00Z', 'zstd', Buffer.from('bad'));
    database.close();

    const sessions = await listSqliteSessions('zed', [filePath]);
    const entries = await loadSqliteEntries(sessions[0]?.filePath ?? '', [filePath]);

    expect(sessions).toHaveLength(2);
    expect(sessions.map((session) => {
      return session.messageCount;
    })).toEqual([2, 2]);
    expect(entries).toHaveLength(2);
  });

  test('skips empty Zed rows and reads uncompressed text values', async () => {
    const root = await mkdtemp(join(tmpdir(), 'zed-incomplete-'));
    const filePath = join(root, 'threads.db');
    const database = new DatabaseSync(filePath);

    database.exec(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY, summary TEXT, updated_at TEXT,
        data_type, data BLOB
      )
    `);
    database.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?)')
      .run('', '', '', 'json', JSON.stringify({
        messages: [{
          role: 'user',
          content: 'ignored',
        }],
      }));
    database.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?)')
      .run('empty', '', '', 'json', '{}');
    database.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?)')
      .run('text', '', '', 'json', JSON.stringify({
        messages: [{
          role: 'user',
          content: 'Question',
          timestamp: 'invalid',
        }],
      }));
    database.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?)')
      .run('assistant-only', '', '', 7, Buffer.from(JSON.stringify({
        messages: [{
          role: 'assistant',
          content: 'Answer',
        }],
      })));
    database.close();

    const sessions = await listSqliteSessions('zed', [filePath]);
    const text = sessions.find((session) => {
      return session.actualSessionId === 'text';
    });
    const assistantOnly = sessions.find((session) => {
      return session.actualSessionId === 'assistant-only';
    });

    expect(text).toMatchObject({
      actualSessionId: 'text',
      title: undefined,
      messageCount: 1,
    });
    expect(assistantOnly).toMatchObject({
      preview: undefined,
      messageCount: 1,
    });
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
