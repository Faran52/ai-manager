import {
  mkdir,
  mkdtemp,
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
  it,
} from 'vitest';

import {
  listOpenCodeProjects,
  listOpenCodeSessions,
  loadOpenCodeEntries,
} from './openCodeUtils';

let root = '';
let databasePath = '';

const reference = (sessionId: string): string => {
  return `oc:${Buffer.from(JSON.stringify({
    databasePath,
    sessionId,
  })).toString('base64url')}`;
};

const createSession = (
  database: DatabaseSync,
  id: string,
  directory: string | null,
  created: number,
): void => {
  database.prepare(
    'INSERT INTO session (id, title, directory, parent_id, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, `Session ${id}`, directory, null, created, created + 1_000);
};

const addMessage = (
  database: DatabaseSync,
  id: string,
  sessionId: string,
  role: string,
  created: number,
): void => {
  database.prepare(
    'INSERT INTO message (id, session_id, time_created, data) VALUES (?, ?, ?, ?)',
  ).run(id, sessionId, created, JSON.stringify({ role }));
};

const addPart = (
  database: DatabaseSync,
  id: string,
  messageId: string | number,
  created: number,
  data: object | string | null,
): void => {
  const value = data === null || typeof data === 'string' ? data : JSON.stringify(data);

  database.prepare(
    'INSERT INTO part (id, message_id, session_id, time_created, data) VALUES (?, ?, ?, ?, ?)',
  ).run(id, messageId, 'ses_a', created, value);
};

const addRawMessage = (
  database: DatabaseSync,
  id: string,
  sessionId: string,
  created: number | null,
  data: object,
): void => {
  database.prepare(
    'INSERT INTO message (id, session_id, time_created, data) VALUES (?, ?, ?, ?)',
  ).run(id, sessionId, created, JSON.stringify(data));
};

const addRawPart = (
  database: DatabaseSync,
  id: string,
  sessionId: string,
  messageId: string | number,
  created: number | null,
  data: object,
): void => {
  database.prepare(
    'INSERT INTO part (id, message_id, session_id, time_created, data) VALUES (?, ?, ?, ?, ?)',
  ).run(id, messageId, sessionId, created, JSON.stringify(data));
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'opencode-'));
  await mkdir(join(root, 'data'), { recursive: true });
  databasePath = join(root, 'data', 'opencode.db');

  const database = new DatabaseSync(databasePath);

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

  createSession(database, 'ses_a', '/repo/alpha', 1_000);
  addMessage(database, 'msg_1', 'ses_a', 'user', 1_000);
  addPart(database, 'part_1', 'msg_1', 1_000, {
    type: 'text',
    text: 'First question',
  });
  addPart(database, 'part_2', 'msg_1', 1_001, {
    type: 'text',
    text: '',
  });
  addRawMessage(database, 'msg_2', 'ses_a', 2_000, {
    role: 'assistant',
    modelID: 'stealth/ox-alpha',
    providerID: 'openrouter',
    cost: 0.25,
    finish: 'tool-calls',
    tokens: {
      input: 10,
      output: 3,
      cache: {
        write: 2,
        read: 4,
      },
    },
  });
  addPart(database, 'part_3', 'msg_2', 2_000, {
    type: 'reasoning',
    text: 'pondering',
  });
  addPart(database, 'part_4', 'msg_2', 2_001, {
    type: 'tool',
    tool: 'bash',
    callID: 'call_9',
    state: {
      status: 'completed',
      input: { command: 'ls -la' },
      output: { text: 'out.txt' },
    },
  });
  addPart(database, 'part_5', 'msg_2', 2_002, { type: 'step-start' });
  addPart(database, 'part_5b', 'msg_2', 2_003, {
    type: 'text',
    text: 'Answer text',
  });
  addRawMessage(database, 'msg_3', 'ses_a', 3_000, {
    role: 'assistant',
    tokens: {},
  });
  addPart(database, 'part_6', 'msg_3', 3_000, {
    type: 'tool',
    tool: 'read',
    callID: 'call_10',
    state: {
      status: 'pending',
      input: { file_path: '/x' },
    },
  });

  database.prepare(
    'INSERT INTO session (id, title, directory, parent_id, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ses_b', null, null, null, 5_000, null);
  addMessage(database, 'msg_b', 'ses_b', 'user', 5_000);
  addPart(database, 'part_b1', 'msg_b', 5_000, '<system-reminder>ctx</system-reminder>');
  addPart(database, 'part_b2', 'msg_b', 5_001, '[1,2]');
  addPart(database, 'part_b3', 'msg_b', 5_002, null);
  addMessage(database, 'msg_c', 'ses_b', 'assistant', 6_000);
  addPart(database, 'part_c1', 'msg_c', 6_000, {
    type: 'tool',
    state: 'not-an-object',
    callID: null,
  });
  addPart(database, 'part_c2', 'msg_c', 6_001, {
    type: 'tool',
    tool: 'custom_tool',
    state: {
      status: 'error',
      output: 42,
    },
  });
  addPart(database, 'part_c3', 'msg_c', 6_002, {
    type: 'text',
    text: '',
  });
  addPart(database, 'part_c4', 'msg_c', 6_003, {
    type: 'tool',
    tool: 'grep',
    state: {
      status: 'completed',
      input: { pattern: 'y' },
      output: 'plain lines',
    },
  });
  addPart(database, 'part_c5', 'msg_c', 6_004, {
    type: 'tool',
    tool: 'grep',
    state: {
      status: 'completed',
      input: { pattern: 'z' },
      output: '',
    },
  });
  database.prepare(
    'INSERT INTO part (id, message_id, session_id, time_created, data) VALUES (?, ?, ?, ?, ?)',
  ).run(
    777,
    'msg_c',
    'ses_b',
    6_005,
    JSON.stringify({
      type: 'tool',
      tool: 'multi-edit',
      callID: 'call_30',
      state: {
        status: 'completed',
        input: {
          file_path: '/f',
          replace_all: true,
          limit: 5,
          offset: 0,
          todos: [{
            text: 'todo',
            status: 'pending',
          }],
          edits: [{
            old_string: 'a',
            new_string: 'b',
            replace_all: true,
          }],
        },
        output: 'edited',
      },
    }),
  );
  addRawMessage(database, 'msg_d', 'ses_b', null, { role: 'user' });
  addRawPart(database, 'part_d', 'ses_b', 'msg_d', null, {
    type: 'text',
    text: 'No timestamp',
  });

  database.prepare(
    'INSERT INTO session (id, title, directory, parent_id, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ses_e', 'Named', '/repo/beta', null, 7_000, 8_000);
  addMessage(database, 'msg_e', 'ses_e', 'user', 7_000);
  addPart(database, 'part_e1', 'msg_e', 7_000, {
    type: 'text',
    text: '<system-reminder>x</system-reminder>',
  });
  addPart(database, 'part_e2', 'msg_e', 7_001, {
    type: 'text',
    text: 42,
  });
  addRawMessage(database, 'msg_f', 'ses_e', 7_500, { role: 'assistant' });
  addPart(database, 'part_f1', 'msg_f', 7_500, {
    type: 'tool',
    tool: 'webfetch',
    callID: 'call_20',
    state: {
      status: 'completed',
      input: { url: 'https://x.dev' },
      output: true,
    },
  });
  addPart(database, 'part_f2', 'msg_f', 7_501, {
    type: 'tool',
    tool: 'grep',
    state: {
      status: 'completed',
      input: { pattern: 'x' },
      output: { bytes: 5 },
    },
  });

  database.prepare(
    'INSERT INTO session (id, title, directory, parent_id, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ses_h', null, '/repo/h', null, 9_000, null);
  addMessage(database, 'msg_h', 'ses_h', 'tool-result', 9_000);
  addRawPart(database, 'part_h1', 'ses_h', 'msg_h', 9_000, {
    type: 'text',
    text: 'orphan',
  });
  database.prepare(
    'INSERT INTO part (id, message_id, session_id, time_created, data) VALUES (?, ?, ?, ?, ?)',
  ).run(
    new Uint8Array([1]),
    'msg_h',
    'ses_h',
    9_001,
    JSON.stringify({
      type: 'text',
      text: 'blobbed',
    }),
  );

  database.prepare(
    'INSERT INTO session (id, title, directory, parent_id, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ses_j', null, '/repo/j', null, 12_000, 13_000);
  addMessage(database, 'msg_j', 'ses_j', 'tool-result', 12_000);
  database.prepare(
    'INSERT INTO session (id, title, directory, parent_id, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ses_i', null, '', null, 10_000, 11_000);
  addMessage(database, 'msg_i', 'ses_i', 'user', 10_000);
  addPart(database, 'part_i1', 'msg_i', 10_000, {
    type: 'text',
    text: '<system-reminder>y</system-reminder>',
  });

  database.prepare(
    'INSERT INTO session (id, title, directory, parent_id, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ses_t', 'file:///Users/dev/Pictures/DNCR_Screen.png', '/repo/t', null, 14_000, 14_500);
  addMessage(database, 'msg_t', 'ses_t', 'user', 14_000);
  addPart(database, 'part_t1', 'msg_t', 14_000, {
    type: 'text',
    text: 'Explain this screenshot',
  });

  database.prepare(
    'INSERT INTO session (id, title, directory, parent_id, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ses_u', 'file://', '/repo/u', null, 15_000, 15_500);
  addMessage(database, 'msg_u', 'ses_u', 'user', 15_000);
  addPart(database, 'part_u1', 'msg_u', 15_000, {
    type: 'text',
    text: 'Real question',
  });

  database.prepare(
    'INSERT INTO session (id, title, directory, parent_id, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ses_v', 'file://%zz', '/repo/v', null, 15_600, 15_700);
  addMessage(database, 'msg_v', 'ses_v', 'user', 15_600);
  addPart(database, 'part_v1', 'msg_v', 15_600, {
    type: 'text',
    text: 'Malformed url title',
  });

  database.prepare(
    'INSERT INTO session (id, title, directory, parent_id, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ses_w', '   ', '/repo/w', null, 16_000, 16_500);
  addMessage(database, 'msg_w', 'ses_w', 'user', 16_000);
  addPart(database, 'part_w1', 'msg_w', 16_000, {
    type: 'text',
    text: 'Another question',
  });

  const broken = new DatabaseSync(join(root, 'data', 'broken.db'));

  broken.exec('CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT)');
  broken.prepare('INSERT INTO message VALUES (?, ?, ?, ?)').run('m', 's', 0, '{not json');
  broken.close();

  await writeFile(join(root, 'data', 'corrupt.db'), Buffer.from('this is not a database'));

  database.close();
});

afterEach(() => {
  process.chdir(tmpdir());
});

describe('listOpenCodeSessions', () => {
  it('builds summaries and previews from genuine first user text', async () => {
    const sessions = await listOpenCodeSessions('opencode', [join(root, 'data')]);

    expect(sessions).toHaveLength(8);

    const alpha = sessions.find((session) => {
      return session.actualSessionId === 'ses_a';
    });

    expect(alpha).toMatchObject({
      title: 'Session ses_a',
      projectId: '/repo/alpha',
      cwd: '/repo/alpha',
      preview: 'First question',
      messageCount: 2,
      firstTimestampMs: 1_000,
    });
  });

  it('falls back to no preview and no cwd for anonymous sessions', async () => {
    const sessions = await listOpenCodeSessions('opencode', [join(root, 'data')]);
    const beta = sessions.find((session) => {
      return session.actualSessionId === 'ses_b';
    });

    expect(beta?.preview).toBe('No timestamp');
    expect(beta?.cwd).toBeUndefined();
  });

  it('titles untitled sessions from their first real user message', async () => {
    const sessions = await listOpenCodeSessions('opencode', [join(root, 'data')]);
    const beta = sessions.find((session) => {
      return session.actualSessionId === 'ses_b';
    });
    const anonymous = sessions.find((session) => {
      return session.actualSessionId === 'ses_i';
    });

    expect(beta?.title).toBe('No timestamp');
    expect(anonymous?.title).toBeUndefined();
  });

  it('replaces file-URL titles with the URL file name', async () => {
    const sessions = await listOpenCodeSessions('opencode', [join(root, 'data')]);
    const titled = sessions.find((session) => {
      return session.actualSessionId === 'ses_t';
    });

    expect(titled?.title).toBe('DNCR_Screen.png');
    expect(titled?.preview).toBe('Explain this screenshot');
  });

  it('falls back to the first user message when a title is a bare or broken file URL', async () => {
    const sessions = await listOpenCodeSessions('opencode', [join(root, 'data')]);

    const bare = sessions.find((session) => {
      return session.actualSessionId === 'ses_u';
    });

    expect(bare?.title).toBe('Real question');

    const malformed = sessions.find((session) => {
      return session.actualSessionId === 'ses_v';
    });

    expect(malformed?.title).toBe('Malformed url title');
  });

  it('treats a blank stored title as missing', async () => {
    const sessions = await listOpenCodeSessions('opencode', [join(root, 'data')]);
    const blank = sessions.find((session) => {
      return session.actualSessionId === 'ses_w';
    });

    expect(blank?.title).toBe('Another question');
  });

  it('filters sessions by project id', async () => {
    const sessions = await listOpenCodeSessions('opencode', [join(root, 'data')], '/repo/alpha');

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.actualSessionId).toBe('ses_a');
  });
});

describe('listOpenCodeProjects', () => {
  it('groups by session directory and names projects by folder', async () => {
    const projects = await listOpenCodeProjects('opencode', [join(root, 'data')]);

    expect(projects).toHaveLength(7);

    const alpha = projects.find((project) => {
      return project.id === '/repo/alpha';
    });

    expect(alpha).toMatchObject({
      agent: 'opencode',
      name: 'alpha',
      actualPath: '/repo/alpha',
      sessionCount: 1,
      messageCount: 2,
    });
  });
});

describe('loadOpenCodeEntries', () => {
  it('maps text, reasoning, completed tools, and skips pending tools', async () => {
    const entries = await loadOpenCodeEntries(reference('ses_a'), [root]);

    expect(entries).toHaveLength(4);
    expect(entries?.[0]).toMatchObject({
      kind: 'user',
      uuid: 'msg_1',
      meta: false,
      text: 'First question',
    });
    expect(entries?.[1]).toMatchObject({
      kind: 'assistant',
      uuid: 'msg_2',
      model: 'stealth/ox-alpha',
      stopReason: 'tool-calls',
      usage: {
        inputTokens: 10,
        outputTokens: 3,
        cacheCreationTokens: 2,
        cacheReadTokens: 4,
      },
      costUsd: 0.25,
      blocks: [
        {
          blockType: 'thinking',
          thinking: 'pondering',
        },
        {
          blockType: 'tool-use',
          call: {
            id: 'call_9',
            name: 'bash',
            input: {
              kind: 'bash',
              command: 'ls -la',
              description: undefined,
            },
          },
        },
        {
          blockType: 'text',
          text: 'Answer text',
        },
      ],
    });
    expect(entries?.[2]).toMatchObject({
      kind: 'user',
      uuid: 'msg_2-outcomes',
      meta: true,
      outcomes: [{
        toolUseId: 'call_9',
        status: 'ok',
        text: 'out.txt',
      }],
    });
    expect(entries?.[3]).toMatchObject({
      kind: 'assistant',
      uuid: 'msg_3',
      blocks: [{
        blockType: 'tool-use',
        call: {
          id: 'call_10',
          name: 'read',
          input: {
            kind: 'file-read',
            path: '/x',
          },
        },
      }],
    });
  });

  it('survives malformed tool parts and maps error outcomes with scalar output', async () => {
    const entries = await loadOpenCodeEntries(reference('ses_b'), [root]);

    expect(entries?.[0]).toMatchObject({
      kind: 'user',
      uuid: 'msg_d',
      text: 'No timestamp',
    });
    expect(entries?.[2]).toMatchObject({
      kind: 'assistant',
      uuid: 'msg_c',
      blocks: [
        {
          blockType: 'tool-use',
          call: {
            id: 'part_c1',
            name: 'tool',
            input: {
              kind: 'generic',
              title: 'tool',
              rows: [],
            },
          },
        },
        {
          blockType: 'tool-use',
          call: {
            id: 'part_c2',
            name: 'custom_tool',
            input: {
              kind: 'generic',
              title: 'custom_tool',
              rows: [],
            },
          },
        },
        {
          blockType: 'tool-use',
          call: {
            id: 'part_c4',
            name: 'grep',
            input: {
              kind: 'search-files',
              tool: 'grep',
              pattern: 'y',
              searchPath: undefined,
            },
          },
        },
        {
          blockType: 'tool-use',
          call: {
            id: 'part_c5',
            name: 'grep',
            input: {
              kind: 'search-files',
              tool: 'grep',
              pattern: 'z',
              searchPath: undefined,
            },
          },
        },
        {
          blockType: 'tool-use',
          call: {
            id: 'call_30',
            name: 'multi-edit',
            input: {
              kind: 'multi-edit',
              path: '/f',
              edits: [{
                oldString: 'a',
                newString: 'b',
                replaceAll: true,
              }],
            },
          },
        },
      ],
    });
    expect(entries?.[3]).toMatchObject({
      kind: 'user',
      outcomes: [
        {
          toolUseId: 'part_c1',
          status: 'interrupted',
          text: undefined,
        },
        {
          toolUseId: 'part_c2',
          status: 'error',
          text: '42',
        },
        {
          toolUseId: 'part_c4',
          status: 'ok',
          text: 'plain lines',
        },
        {
          toolUseId: 'part_c5',
          status: 'ok',
          text: undefined,
        },
        {
          toolUseId: 'call_30',
          status: 'ok',
          text: 'edited',
        },
      ],
    });
  });

  it('truncates the folder name for previews when only meta text exists', async () => {
    const sessions = await listOpenCodeSessions('opencode', [join(root, 'data')]);
    const gamma = sessions.find((session) => {
      return session.actualSessionId === 'ses_e';
    });

    expect(gamma?.preview).toBe('beta');
    expect(gamma?.messageCount).toBe(0);

    const gammaEntries = await loadOpenCodeEntries(reference('ses_e'), [root]);

    expect(gammaEntries).toHaveLength(3);
    expect(gammaEntries?.[1]).toMatchObject({
      kind: 'assistant',
      blocks: [
        {
          blockType: 'tool-use',
          call: {
            id: 'call_20',
            name: 'webfetch',
            input: {
              kind: 'web-fetch',
              url: 'https://x.dev',
            },
          },
        },
        {
          blockType: 'tool-use',
          call: {
            id: 'part_f2',
            name: 'grep',
          },
        },
      ],
    });
    expect(gammaEntries?.[2]).toMatchObject({
      kind: 'user',
      uuid: 'msg_f-outcomes',
      outcomes: [
        {
          toolUseId: 'call_20',
          status: 'ok',
          text: undefined,
        },
        {
          toolUseId: 'part_f2',
          status: 'ok',
          text: '{"bytes":5}',
        },
      ],
    });
  });

  it('yields undefined when the referenced file is not a database', async () => {
    const payload = {
      databasePath: join(root, 'data'),
      sessionId: 's',
    };
    const dirReference = `oc:${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;

    await expect(loadOpenCodeEntries(dirReference, [root])).resolves.toBeUndefined();
  });

  it('ignores corrupt database files during scans', async () => {
    const projects = await listOpenCodeProjects('opencode', [join(root, 'data')]);

    expect(projects.map((project) => {
      return project.name;
    })).toEqual(expect.arrayContaining(['alpha']));
  });

  it('returns undefined for foreign references and paths outside the roots', async () => {
    await expect(loadOpenCodeEntries('/plain/path', [root])).resolves.toBeUndefined();
    await expect(loadOpenCodeEntries(reference('ses_a'), ['/somewhere-else']))
      .resolves.toBeUndefined();
  });

  it('returns undefined for malformed references', async () => {
    const notBase64 = 'oc:%%%';
    const wrongShape = `oc:${Buffer.from(JSON.stringify({ databasePath })).toString('base64url')}`;
    const notJson = `oc:${Buffer.from('[1,2]').toString('base64url')}`;

    await expect(loadOpenCodeEntries(notBase64, [root])).resolves.toBeUndefined();
    await expect(loadOpenCodeEntries(wrongShape, [root])).resolves.toBeUndefined();
    await expect(loadOpenCodeEntries(notJson, [root])).resolves.toBeUndefined();
  });

  it('yields no entries when every message payload is unreadable', async () => {
    const brokenReference = reference('s').replace('opencode.db', 'broken.db');
    const entries = await loadOpenCodeEntries(brokenReference, [root]);

    expect(entries).toEqual([]);
  });
});
