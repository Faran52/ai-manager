import {
  chmod,
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

import { pairToolOutcomes } from './outcomeUtils';
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

  const EXPECTED_ENTRIES_5 = [
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
  ];

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
    expect(entries).toMatchObject(EXPECTED_ENTRIES_5);
  });

  const EXPECTED_SQLITE_ENTRIES = [
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
  ];

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
    expect(await loadSqliteEntries(sessions[0]?.filePath ?? '', [filePath])).toMatchObject(EXPECTED_SQLITE_ENTRIES);
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

  const EXPECTED_ENTRIES_4 = [
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
  ];

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
    expect(entries).toMatchObject(EXPECTED_ENTRIES_4);
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

  const EXPECTED_ENTRIES_3 = [
    {
      kind: 'user',
      text: 'Question',
    },
    {
      kind: 'assistant',
      model: 'claude-sonnet-5',
      blocks: [{
        blockType: 'text',
        text: 'Answer',
      }],
    },
  ];

  test('reads text parts from a Crush message and skips a tool-role row', async () => {
    const root = await mkdtemp(join(tmpdir(), 'crush-history-'));
    const filePath = join(root, 'crush.db');
    const database = new DatabaseSync(filePath);

    // Columns match charmbracelet/crush's initial migration verbatim.
    database.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY, title TEXT, message_count INTEGER,
        updated_at INTEGER, created_at INTEGER
      );
      CREATE TABLE messages (
        id TEXT PRIMARY KEY, session_id TEXT, role TEXT, parts TEXT,
        model TEXT, created_at INTEGER, updated_at INTEGER
      );
    `);
    database.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?)')
      .run('sess-1', 'Fix the build', 3, 1_767_225_602, 1_767_225_600);
    database.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'm1',
      'sess-1',
      'user',
      JSON.stringify([{
        type: 'text',
        data: { text: 'Question' },
      }]),
      null,
      1_767_225_600,
      1_767_225_600,
    );
    database.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'm2',
      'sess-1',
      'assistant',
      JSON.stringify([
        {
          type: 'tool_call',
          data: { name: 'bash' },
        },
        {
          type: 'text',
          data: { text: 'Answer' },
        },
      ]),
      'claude-sonnet-5',
      1_767_225_601,
      1_767_225_601,
    );
    database.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'm3',
      'sess-1',
      'tool',
      JSON.stringify([{
        type: 'tool_result',
        data: { text: 'ok' },
      }]),
      null,
      1_767_225_602,
      1_767_225_602,
    );
    database.close();

    const sessions = await listSqliteSessions('crush', [filePath]);
    const entries = await loadSqliteEntries(sessions[0]?.filePath ?? '', [filePath]);

    expect(sessions).toMatchObject([{
      actualSessionId: 'sess-1',
      title: 'Fix the build',
    }]);
    expect(entries).toMatchObject(EXPECTED_ENTRIES_3);
  });

  test('skips a Crush session left with no readable text', async () => {
    const root = await mkdtemp(join(tmpdir(), 'crush-empty-'));
    const filePath = join(root, 'crush.db');
    const database = new DatabaseSync(filePath);

    database.exec(`
      CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT, updated_at INTEGER, created_at INTEGER);
      CREATE TABLE messages (
        id TEXT PRIMARY KEY, session_id TEXT, role TEXT, parts TEXT,
        model TEXT, created_at INTEGER, updated_at INTEGER
      );
    `);
    database.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run('empty', 'Untouched', 1, 1);
    database.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'm1',
      'empty',
      'assistant',
      JSON.stringify([{
        type: 'tool_call',
        data: { name: 'bash' },
      }]),
      null,
      1,
      1,
    );
    // A malformed parts column (not a JSON array at all) reads as no text too.
    database.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'm2',
      'empty',
      'user',
      JSON.stringify({ not: 'an array' }),
      null,
      2,
      2,
    );
    database.close();

    expect(await listSqliteSessions('crush', [filePath])).toEqual([]);
  });

  test('falls back on a blank Crush title, timestamp and unreadable text part', async () => {
    const root = await mkdtemp(join(tmpdir(), 'crush-fallbacks-'));
    const filePath = join(root, 'crush.db');
    const database = new DatabaseSync(filePath);

    database.exec(`
      CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT, updated_at INTEGER, created_at INTEGER);
      CREATE TABLE messages (
        id TEXT PRIMARY KEY, session_id TEXT, role TEXT, parts TEXT,
        model TEXT, created_at INTEGER, updated_at INTEGER
      );
    `);
    database.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run('sess-1', '', 1, 1);
    // A text part with nothing readable in its data, alongside a real one.
    database.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'm1',
      'sess-1',
      'user',
      JSON.stringify([{
        type: 'text',
        data: {},
      }, {
        type: 'text',
        data: { text: 'Question' },
      }]),
      null,
      null,
      null,
    );
    database.close();

    const sessions = await listSqliteSessions('crush', [filePath]);

    expect(sessions).toMatchObject([{
      actualSessionId: 'sess-1',
      title: undefined,
    }]);
  });

  test('drops a stale Crush reference once its tables are gone', async () => {
    const root = await mkdtemp(join(tmpdir(), 'crush-stale-'));
    const filePath = join(root, 'crush.db');
    const database = new DatabaseSync(filePath);

    database.exec(`
      CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT, updated_at INTEGER, created_at INTEGER);
      CREATE TABLE messages (
        id TEXT PRIMARY KEY, session_id TEXT, role TEXT, parts TEXT,
        model TEXT, created_at INTEGER, updated_at INTEGER
      );
    `);
    database.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run('sess-1', 'Title', 1, 1);
    database.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      'm1', 'sess-1', 'user', JSON.stringify([{
        type: 'text',
        data: { text: 'Hi' },
      }]), null, 1, 1,
    );
    database.close();

    const sessions = await listSqliteSessions('crush', [filePath]);
    const reopened = new DatabaseSync(filePath);

    reopened.exec('DROP TABLE messages');
    reopened.close();

    expect(await loadSqliteEntries(sessions[0]?.filePath ?? '', [filePath])).toBeUndefined();
  });

  const EXPECTED_ENTRIES_2 = [
    {
      kind: 'system',
      text: 'Be terse.',
    },
    {
      kind: 'user',
      text: 'Question',
    },
    {
      kind: 'assistant',
      model: 'gpt-4o-mini-2026',
      blocks: [{
        blockType: 'text',
        text: 'Answer',
      }],
    },
    {
      kind: 'user',
      text: 'Follow-up',
    },
    {
      kind: 'assistant',
      blocks: [{
        blockType: 'text',
        text: 'Second answer',
      }],
    },
  ];

  test('decodes an llm conversation from its prompt/response rows, one row per exchange', async () => {
    const root = await mkdtemp(join(tmpdir(), 'llm-history-'));
    const filePath = join(root, 'logs.db');
    const database = new DatabaseSync(filePath);

    // Columns match llm/migrations.py verbatim, trimmed to the ones this reads.
    database.exec(`
      CREATE TABLE conversations (id TEXT PRIMARY KEY, name TEXT, model TEXT);
      CREATE TABLE responses (
        id TEXT PRIMARY KEY, conversation_id TEXT, model TEXT, resolved_model TEXT,
        prompt TEXT, system TEXT, response TEXT, duration_ms INTEGER, datetime_utc TEXT
      );
    `);
    database.prepare('INSERT INTO conversations VALUES (?, ?, ?)')
      .run('conv-1', 'Question about llm', 'gpt-4o-mini');
    database.prepare(`
      INSERT INTO responses
        (id, conversation_id, model, resolved_model, prompt, system, response, duration_ms, datetime_utc)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'r1', 'conv-1', 'gpt-4o-mini', 'gpt-4o-mini-2026', 'Question', 'Be terse.', 'Answer', 500, '2026-01-01T00:00:00',
    );
    database.prepare(`
      INSERT INTO responses
        (id, conversation_id, model, resolved_model, prompt, system, response, duration_ms, datetime_utc)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'r2', 'conv-1', 'gpt-4o-mini', 'gpt-4o-mini-2026', 'Follow-up', '', 'Second answer', 200, '2026-01-01T00:01:00',
    );
    database.close();

    const sessions = await listSqliteSessions('llm', [filePath]);
    const entries = await loadSqliteEntries(sessions[0]?.filePath ?? '', [filePath]);

    expect(sessions).toMatchObject([{
      actualSessionId: 'conv-1',
      title: 'Question about llm',
    }]);
    // The system prompt is named once, on the first exchange, not repeated on the second.
    expect(entries).toMatchObject(EXPECTED_ENTRIES_2);
  });

  test('skips an llm conversation left with no responses', async () => {
    const root = await mkdtemp(join(tmpdir(), 'llm-empty-'));
    const filePath = join(root, 'logs.db');
    const database = new DatabaseSync(filePath);

    database.exec(`
      CREATE TABLE conversations (id TEXT PRIMARY KEY, name TEXT, model TEXT);
      CREATE TABLE responses (
        id TEXT PRIMARY KEY, conversation_id TEXT, model TEXT, resolved_model TEXT,
        prompt TEXT, system TEXT, response TEXT, duration_ms INTEGER, datetime_utc TEXT
      );
    `);
    database.prepare('INSERT INTO conversations VALUES (?, ?, ?)').run('empty', 'Untouched', 'gpt-4o-mini');
    database.close();

    expect(await listSqliteSessions('llm', [filePath])).toEqual([]);
  });

  test('falls back on a blank llm conversation name', async () => {
    const root = await mkdtemp(join(tmpdir(), 'llm-noname-'));
    const filePath = join(root, 'logs.db');
    const database = new DatabaseSync(filePath);

    database.exec(`
      CREATE TABLE conversations (id TEXT PRIMARY KEY, name TEXT, model TEXT);
      CREATE TABLE responses (
        id TEXT PRIMARY KEY, conversation_id TEXT, model TEXT, resolved_model TEXT,
        prompt TEXT, system TEXT, response TEXT, duration_ms INTEGER, datetime_utc TEXT
      );
    `);
    database.prepare('INSERT INTO conversations VALUES (?, ?, ?)').run('conv-1', null, 'gpt-4o-mini');
    // An unparseable timestamp and a missing duration both fall back too.
    database.prepare(`
      INSERT INTO responses (id, conversation_id, prompt, response, duration_ms, datetime_utc)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('r1', 'conv-1', 'Hi', 'Hello', null, 'not-a-date');
    database.close();

    expect(await listSqliteSessions('llm', [filePath])).toMatchObject([{
      actualSessionId: 'conv-1',
      title: undefined,
    }]);
  });

  test('drops a stale llm reference once its tables are gone', async () => {
    const root = await mkdtemp(join(tmpdir(), 'llm-stale-'));
    const filePath = join(root, 'logs.db');
    const database = new DatabaseSync(filePath);

    database.exec(`
      CREATE TABLE conversations (id TEXT PRIMARY KEY, name TEXT, model TEXT);
      CREATE TABLE responses (
        id TEXT PRIMARY KEY, conversation_id TEXT, model TEXT, resolved_model TEXT,
        prompt TEXT, system TEXT, response TEXT, duration_ms INTEGER, datetime_utc TEXT
      );
    `);
    database.prepare('INSERT INTO conversations VALUES (?, ?, ?)').run('conv-1', 'Title', 'gpt-4o-mini');
    database.prepare(`
      INSERT INTO responses (id, conversation_id, prompt, response, duration_ms, datetime_utc)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('r1', 'conv-1', 'Hi', 'Hello', 100, '2026-01-01T00:00:00');
    database.close();

    const sessions = await listSqliteSessions('llm', [filePath]);
    const reopened = new DatabaseSync(filePath);

    reopened.exec('DROP TABLE responses');
    reopened.close();

    expect(await loadSqliteEntries(sessions[0]?.filePath ?? '', [filePath])).toBeUndefined();
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

    const locked = join(root, 'locked');

    await mkdir(join(root, 'node_modules'));
    await mkdir(join(root, '.git'));
    await mkdir(locked);
    createDatabase(join(locked, 'unreachable.db'));
    await chmod(locked, 0o000);
    createDatabase(join(deep, 'hidden.db'));

    expect(await listSqliteProjects('cursor', [root])).toEqual([]);

    await chmod(locked, 0o700);
  });
  const EXPECTED_ENTRIES = {
    kind: 'assistant',
    blocks: [{
      blockType: 'tool-use',
      call: {
        id: 'call-1',
        name: 'Read',
        input: {
          kind: 'file-read',
          path: '/repo/README.md',
        },
      },
    }],
  };

  test('renders Cursor tool calls, their results and single thought bubbles', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cursor-tools-'));
    const filePath = join(root, 'state.vscdb');
    const database = new DatabaseSync(filePath);

    database.exec(`
      CREATE TABLE cursorDiskKV (key TEXT UNIQUE, value BLOB);
      CREATE TABLE ItemTable (key TEXT UNIQUE, value BLOB);
    `);
    database.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)')
      .run('composerData:composer-2', Buffer.from(JSON.stringify({
        composerId: 'composer-2',
        createdAt: 1_767_225_600_000,
        fullConversationHeadersOnly: [
          {
            bubbleId: 'u1',
            type: 1,
          },
          {
            bubbleId: 'thought',
            type: 2,
          },
          {
            bubbleId: 'tool-ok',
            type: 2,
          },
          {
            bubbleId: 'tool-bad',
            type: 2,
          },
          {
            bubbleId: 'tool-unmapped',
            type: 2,
          },
        ],
      })));
    database.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)')
      .run('bubbleId:composer-2:u1', Buffer.from(JSON.stringify({
        type: 1,
        text: 'Read the readme',
        createdAt: 1_767_225_600_000,
      })));
    database.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)')
      .run('bubbleId:composer-2:thought', Buffer.from(JSON.stringify({
        type: 2,
        isThought: true,
        text: 'Considering the request',
        createdAt: 1_767_225_600_500,
      })));
    database.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)')
      .run('bubbleId:composer-2:tool-ok', Buffer.from(JSON.stringify({
        type: 2,
        text: '# Title',
        createdAt: 1_767_225_601_000,
        toolFormerData: {
          name: 'read_file',
          toolCallId: 'call-1',
          status: 'completed',
          rawArgs: JSON.stringify({ file_path: '/repo/README.md' }),
        },
      })));
    database.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)')
      .run('bubbleId:composer-2:tool-bad', Buffer.from(JSON.stringify({
        type: 2,
        text: 'command not found',
        createdAt: 1_767_225_602_000,
        toolFormerData: {
          name: 'run_terminal_cmd',
          status: 'rejected',
          rawArgs: 'not-json',
        },
      })));
    database.prepare('INSERT INTO cursorDiskKV VALUES (?, ?)')
      .run('bubbleId:composer-2:tool-unmapped', Buffer.from(JSON.stringify({
        type: 2,
        text: '',
        createdAt: 1_767_225_603_000,
        toolFormerData: { toolCallId: 'call-3' },
      })));
    database.close();

    const sessions = await listSqliteSessions('cursor', [filePath]);
    const entries = await loadSqliteEntries(sessions[0]?.filePath ?? '', [filePath]);
    const outcomes = pairToolOutcomes(entries ?? []);

    expect(entries?.[1]).toMatchObject({
      kind: 'assistant',
      blocks: [{
        blockType: 'thinking',
        thinking: 'Considering the request',
      }],
    });
    expect(entries?.[2]).toMatchObject(EXPECTED_ENTRIES);
    expect(outcomes.get('call-1')).toMatchObject({
      status: 'ok',
      text: '# Title',
    });
    expect(outcomes.get('tool-bad')).toMatchObject({ status: 'error' });
    expect(outcomes.get('call-3')?.text).toBeUndefined();

    const names = (entries ?? []).flatMap((entry) => {
      return entry.kind === 'assistant'
        ? entry.blocks.flatMap((block) => {
            return block.blockType === 'tool-use' ? [block.call.name] : [];
          })
        : [];
    });

    expect(names).toEqual(['Read', 'Bash', 'Tool']);
  });
});
