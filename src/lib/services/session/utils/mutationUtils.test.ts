import {
  mkdir,
  mkdtemp,
  readFile,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { resolveAgentPaths } from '@services/agents/agentsService';

import { openCodeStore } from '@mocks/openCodeStoreFixtures';

import {
  deleteProject,
  deleteSession,
  renameSession,
} from './mutationUtils';

import type { AgentId } from '@config/agents';
import type { AgentRoots } from '@services/agents/agentsService';

interface OpenCodeDataDir {
  data: string;
  home: string;
}

interface MutationFixtures {
  readonly roots: AgentRoots;
  readonly claudeFile: string;
  readonly codexFile: string;
}

interface ClineFixture {
  readonly roots: AgentRoots;
  readonly taskDir: string;
  readonly transcript: string;
}

interface StoreFixture {
  readonly roots: AgentRoots;
  readonly databasePath: string;
}

/*
 * Every case builds a real temp tree and a real SQLite file, so on a busy machine
 * one can pass the 5s default on IO alone. Raised for this file only.
 */
vi.setConfig({ testTimeout: 30_000 });

const rootsWithFiles = async (): Promise<MutationFixtures> => {
  const claude = await mkdtemp(join(tmpdir(), 'mutations-claude-'));
  const codex = await mkdtemp(join(tmpdir(), 'mutations-codex-'));
  const claudeFile = join(claude, 'projects', 'p', 's.jsonl');
  const codexFile = join(codex, 'sessions', 'rollout-c.jsonl');

  await mkdir(join(claude, 'projects', 'p'), { recursive: true });
  await mkdir(join(codex, 'sessions'), { recursive: true });
  await writeFile(claudeFile, '{}');
  await writeFile(codexFile, '{}');

  const database = new DatabaseSync(join(codex, 'state_5.sqlite'));
  database.exec('CREATE TABLE threads (id TEXT PRIMARY KEY, name TEXT, title TEXT, updated_at INTEGER)');
  database.prepare('INSERT INTO threads (id, name, title, updated_at) VALUES (?, ?, ?, ?)')
    .run('c', null, 'Old', 0);
  database.close();

  return {
    roots: {
      ...resolveAgentPaths({
        env: {},
        home: join(claude, '..'),
        platform: 'linux',
      }),
      claude: [claude],
      codex: [codex],
    },
    claudeFile,
    codexFile,
  };
};

describe('session rename', () => {
  test('writes native Claude and Codex names', async () => {
    const {
      roots,
      claudeFile,
      codexFile,
    } = await rootsWithFiles();

    await renameSession(roots, {
      agent: 'claude',
      filePath: claudeFile,
      actualSessionId: 's',
    }, ' New name ');
    await renameSession(roots, {
      agent: 'codex',
      filePath: codexFile,
      actualSessionId: 'c',
    }, 'Codex name');

    expect(await readFile(claudeFile, 'utf8')).toContain('"customTitle":"New name"');
    const database = new DatabaseSync(join(roots.codex[0], 'state_5.sqlite'));
    const row = database.prepare('SELECT name FROM threads WHERE id = ?').get('c');
    database.close();
    expect(row).toMatchObject({ name: 'Codex name' });
  });

  test('rejects invalid titles and unsafe paths', async () => {
    const { roots, claudeFile } = await rootsWithFiles();
    const outside = await mkdtemp(join(tmpdir(), 'outside-'));
    const outsideFile = join(outside, 's.jsonl');
    const link = join(roots.claude[0], 'projects', 'p', 'link.jsonl');

    await writeFile(outsideFile, '{}');
    await symlink(claudeFile, link);

    await expect(renameSession(
      roots,
      {
        agent: 'claude',
        filePath: claudeFile,
        actualSessionId: 's',
      },
      '',
    )).rejects.toThrow('between 1 and 200');
    await expect(renameSession(
      roots,
      {
        agent: 'claude',
        filePath: claudeFile,
        actualSessionId: 's',
      },
      'a\nb',
    )).rejects.toThrow('between 1 and 200');
    await expect(deleteSession(
      roots,
      {
        agent: 'claude',
        filePath: outsideFile,
        actualSessionId: 's',
      },
    )).rejects.toThrow('outside');
    await expect(deleteSession(
      roots,
      {
        agent: 'claude',
        filePath: link,
        actualSessionId: 's',
      },
    )).rejects.toThrow('outside');
    await expect(deleteSession(
      roots,
      {
        agent: 'claude',
        filePath: claudeFile.replace('.jsonl', '.png'),
        actualSessionId: 's',
      },
    )).rejects.toThrow('not a transcript');
  });
});

describe('session deletion by artifact shape', () => {
  test('deletes a Copilot chat but refuses its non-transcript neighbours', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mutations-copilot-'));
    const chat = join(root, 'chat.jsonl');
    const resource = join(root, 'content.png');

    await writeFile(chat, 'chat');
    await writeFile(resource, 'attachment');

    const roots: AgentRoots = {
      ...resolveAgentPaths({
        env: {},
        home: root,
        platform: 'linux',
      }),
      claude: [root],
      codex: [root],
      copilot: [join(root, 'gone'), root],
    };

    await expect(deleteSession(
      roots,
      {
        agent: 'copilot',
        filePath: resource,
        actualSessionId: 'a1b2',
      },
    )).rejects.toThrow('That file is not a transcript this agent stores.');

    await deleteSession(roots, {
      agent: 'copilot',
      filePath: chat,
      actualSessionId: 'a1b2',
    });

    await expect(stat(chat)).rejects.toThrow();
  });

  test('refuses a transcript name that is really a folder', async () => {
    const { roots, claudeFile } = await rootsWithFiles();
    const folder = claudeFile.replace('s.jsonl', 'folder.jsonl');

    await mkdir(folder, { recursive: true });

    await expect(deleteSession(roots, {
      agent: 'claude',
      filePath: folder,
      actualSessionId: 'folder',
    })).rejects.toThrow('outside');
  });

  test('refuses an agent whose sessions live in a shared database', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mutations-amazonq-'));
    const databasePath = join(root, 'amazon-q', 'data.sqlite3');
    const roots: AgentRoots = {
      ...resolveAgentPaths({
        env: {},
        home: root,
        platform: 'linux',
      }),
      amazonq: [databasePath],
    };

    await expect(deleteSession(
      roots,
      {
        agent: 'amazonq',
        filePath: `sqlite:${Buffer.from(JSON.stringify({
          databasePath,
          table: 't',
        })).toString('base64url')}`,
        actualSessionId: 's',
      },
    )).rejects.toThrow('shared database');
  });
});

describe('session deletion', () => {
  test('deletes files outright and removes Codex database rows', async () => {
    const {
      roots,
      claudeFile,
      codexFile,
    } = await rootsWithFiles();

    await deleteSession(roots, {
      agent: 'claude',
      filePath: claudeFile,
      actualSessionId: 's',
    });
    await deleteSession(roots, {
      agent: 'codex',
      filePath: codexFile,
      actualSessionId: 'c',
    });

    await expect(readFile(claudeFile)).rejects.toThrow();
    const database = new DatabaseSync(join(roots.codex[0], 'state_5.sqlite'));
    const row = database.prepare('SELECT id FROM threads WHERE id = ?').get('c');
    database.close();
    expect(row).toBeUndefined();
  });
});

describe('OpenCode session deletion', () => {
  const dataDir = async (): Promise<OpenCodeDataDir> => {
    const home = await mkdtemp(join(tmpdir(), 'mutations-opencode-home-'));
    const data = join(home, 'data');

    await mkdir(data, { recursive: true });

    return {
      data,
      home,
    };
  };

  const createDatabase = (
    data: string,
    name = 'opencode.db',
  ): DatabaseSync => {
    const database = openCodeStore(join(data, name));

    return database;
  };

  const seedSession = (database: DatabaseSync, sessionId: string): void => {
    database.prepare(
      'INSERT INTO session (id, title, directory, parent_id, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(sessionId, null, '/repo', null, 1_000, 2_000);
    database.prepare('INSERT INTO message (id, session_id, time_created, data) VALUES (?, ?, ?, ?)')
      .run(`msg_${sessionId}`, sessionId, 1_000, JSON.stringify({ role: 'user' }));
    database.prepare('INSERT INTO part (id, message_id, session_id, time_created, data) VALUES (?, ?, ?, ?, ?)')
      .run(`part_${sessionId}`, `msg_${sessionId}`, sessionId, 1_000, JSON.stringify({
        type: 'text',
        text: 'hi',
      }));
  };

  const countRows = (database: DatabaseSync, table: string): number => {
    return Number(database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n ?? 0);
  };

  const ocReference = (data: string, sessionId: string, name?: string): string => {
    return `oc:${Buffer.from(JSON.stringify({
      databasePath: join(data, name ?? 'opencode.db'),
      sessionId,
    })).toString('base64url')}`;
  };

  test('removes the session row with its messages and parts in one transaction', async () => {
    const { data, home } = await dataDir();
    const roots: AgentRoots = {
      ...resolveAgentPaths({
        env: {},
        home,
        platform: 'linux',
      }),
      opencode: [data],
    };
    const database = createDatabase(data);

    seedSession(database, 'ses_a');
    seedSession(database, 'ses_b');
    database.close();

    await deleteSession(roots, {
      agent: 'opencode',
      filePath: ocReference(data, 'ses_a'),
      actualSessionId: 'ses_a',
    });

    const reopened = new DatabaseSync(join(data, 'opencode.db'), { readOnly: true });

    expect(reopened.prepare('SELECT id FROM session').all()).toEqual([{ id: 'ses_b' }]);
    expect(countRows(reopened, 'message')).toBe(1);
    expect(countRows(reopened, 'part')).toBe(1);
    reopened.close();
  });

  test('refuses a reference whose database sits outside the agent history root', async () => {
    const { data, home } = await dataDir();
    const other = await mkdtemp(join(tmpdir(), 'mutations-opencode-other-'));
    const roots: AgentRoots = {
      ...resolveAgentPaths({
        env: {},
        home,
        platform: 'linux',
      }),
      opencode: [data],
    };
    const database = createDatabase(other);

    seedSession(database, 'ses_x');
    database.close();

    await expect(deleteSession(roots, {
      agent: 'opencode',
      filePath: ocReference(other, 'ses_x'),
      actualSessionId: 'ses_x',
    })).rejects.toThrow('outside its agent history directory');

    const reopened = new DatabaseSync(join(other, 'opencode.db'), { readOnly: true });

    expect(countRows(reopened, 'session')).toBe(1);
    reopened.close();
  });

  test('rolls the transaction back when a delete fails halfway', async () => {
    const { data, home } = await dataDir();
    const roots: AgentRoots = {
      ...resolveAgentPaths({
        env: {},
        home,
        platform: 'linux',
      }),
      opencode: [data],
    };
    const database = createDatabase(data);

    seedSession(database, 'ses_a');
    database.exec('DROP TABLE part');
    database.close();

    await expect(deleteSession(roots, {
      agent: 'opencode',
      filePath: ocReference(data, 'ses_a'),
      actualSessionId: 'ses_a',
    })).rejects.toThrow();

    const reopened = new DatabaseSync(join(data, 'opencode.db'), { readOnly: true });

    expect(countRows(reopened, 'session')).toBe(1);
    expect(countRows(reopened, 'message')).toBe(1);
    reopened.close();
  });

  test('rejects a malformed OpenCode session reference', async () => {
    const { data, home } = await dataDir();
    const roots: AgentRoots = {
      ...resolveAgentPaths({
        env: {},
        home,
        platform: 'linux',
      }),
      opencode: [data],
    };

    await expect(deleteSession(roots, {
      agent: 'opencode',
      filePath: '/not-a-reference',
      actualSessionId: 's',
    })).rejects.toThrow('not a usable OpenCode session reference');
  });
});

describe('project deletion', () => {
  test('deletes a dedicated Claude history folder permanently', async () => {
    const { roots, claudeFile } = await rootsWithFiles();

    await deleteProject(roots, {
      agent: 'claude',
      projectId: 'p',
    });

    await expect(readFile(claudeFile)).rejects.toThrow();
  });

  test('rejects agents and unsafe project history folders', async () => {
    const { roots } = await rootsWithFiles();
    const outside = await mkdtemp(join(tmpdir(), 'project-outside-'));
    const link = join(roots.claude[0], 'projects', 'link');
    const file = join(roots.claude[0], 'projects', 'file');

    await symlink(outside, link);
    await writeFile(file, '{}');

    await expect(deleteProject(roots, {
      agent: 'trae',
      projectId: 'p',
    })).rejects.toThrow(
      'does not store projects',
    );
    await expect(deleteProject(roots, {
      agent: 'claude',
      projectId: 'link',
    })).rejects.toThrow('outside');
    await expect(deleteProject(roots, {
      agent: 'claude',
      projectId: 'file',
    })).rejects.toThrow('outside');
    await expect(deleteProject(roots, {
      agent: 'claude',
      projectId: '.',
    })).rejects.toThrow('outside');
    await expect(deleteProject(roots, {
      agent: 'claude',
      projectId: `../../${basename(outside)}`,
    })).rejects.toThrow('outside');
  });
});

test('rejects mutations for an undecoded shared store', async () => {
  const { roots, claudeFile } = await rootsWithFiles();

  await expect(deleteSession(roots, {
    agent: 'kiro',
    filePath: claudeFile,
    actualSessionId: 's',
  })).rejects.toThrow('stay read-only');
  await expect(renameSession(roots, {
    agent: 'gemini',
    filePath: claudeFile,
    actualSessionId: 's',
  }, 'New')).rejects.toThrow('does not support renaming');
});

describe('deleting a session and its prompts', () => {
  test('takes the prompts of the session away with it', async () => {
    const home = await mkdtemp(join(tmpdir(), 'delete-prompts-'));
    const projectDir = join(home, '.claude', 'projects', 'p');
    const historyPath = join(home, '.claude', 'history.jsonl');
    const filePath = join(projectDir, 'gone.jsonl');

    await mkdir(projectDir, { recursive: true });
    await writeFile(filePath, '{}', 'utf8');
    await writeFile(historyPath, [
      JSON.stringify({
        display: 'asked here',
        project: '/repo',
        sessionId: 'gone',
        timestamp: 2,
      }),
      JSON.stringify({
        display: 'asked elsewhere',
        project: '/repo',
        sessionId: 'stays',
        timestamp: 1,
      }),
    ].join('\n'), 'utf8');

    await deleteSession(
      resolveAgentPaths({
        env: {},
        home,
      }),
      {
        agent: 'claude',
        filePath,
        actualSessionId: 'gone',
      },
      home,
    );

    const left = await readFile(historyPath, 'utf8');

    expect(left).toContain('asked elsewhere');
    expect(left).not.toContain('asked here');
  });
});

describe('folder-backed session deletion', () => {
  const clineRoots = async (): Promise<ClineFixture> => {
    const home = await mkdtemp(join(tmpdir(), 'mutations-cline-'));
    const tasks = join(home, 'ext', 'tasks');
    const taskDir = join(tasks, 'task-1');
    const transcript = join(taskDir, 'api_conversation_history.json');

    await mkdir(taskDir, { recursive: true });
    await writeFile(transcript, '[]');
    await writeFile(join(taskDir, 'ui_messages.json'), '[]');

    return {
      roots: {
        ...resolveAgentPaths({
          env: {},
          home,
          platform: 'linux',
        }),
        cline: [tasks],
      },
      taskDir,
      transcript,
    };
  };

  test('takes the whole task folder, not just the transcript the reader opened', async () => {
    const {
      roots,
      taskDir,
      transcript,
    } = await clineRoots();

    await deleteSession(roots, {
      agent: 'cline',
      filePath: transcript,
      actualSessionId: 'task-1',
    });

    await expect(stat(taskDir)).rejects.toThrow();
  });

  test('takes a folder the reader opened directly', async () => {
    const { roots, taskDir } = await clineRoots();

    await deleteSession(roots, {
      agent: 'cline',
      filePath: taskDir,
      actualSessionId: 'task-1',
    });

    await expect(stat(taskDir)).rejects.toThrow();
  });

  test('refuses when no folder above the file carries the session id', async () => {
    const {
      roots,
      taskDir,
      transcript,
    } = await clineRoots();

    await expect(deleteSession(roots, {
      agent: 'cline',
      filePath: transcript,
      actualSessionId: 'other',
    })).rejects.toThrow('carries the session id');

    expect((await stat(taskDir)).isDirectory()).toBe(true);
  });

  test('refuses a session id that names a file rather than a folder', async () => {
    const { roots } = await clineRoots();
    const stray = join(roots.cline[0] ?? '', 'task-9');

    await writeFile(stray, 'not a folder');

    await expect(deleteSession(roots, {
      agent: 'cline',
      filePath: stray,
      actualSessionId: 'task-9',
    })).rejects.toThrow('outside');
  });

  test('refuses a folder outside the agent history root', async () => {
    const { roots } = await clineRoots();
    const outside = await mkdtemp(join(tmpdir(), 'mutations-cline-outside-'));
    const taskDir = join(outside, 'task-2');

    await mkdir(taskDir, { recursive: true });

    await expect(deleteSession(roots, {
      agent: 'cline',
      filePath: taskDir,
      actualSessionId: 'task-2',
    })).rejects.toThrow('outside');
  });
});

describe('shared store session deletion', () => {
  const storeRoots = async (name: string, agent: AgentId): Promise<StoreFixture> => {
    const home = await mkdtemp(join(tmpdir(), `mutations-${name}-`));
    const databasePath = join(home, `${name}.db`);

    return {
      databasePath,
      roots: {
        ...resolveAgentPaths({
          env: {},
          home,
          platform: 'linux',
        }),
        [agent]: [home],
      },
    };
  };

  const sqliteReference = (databasePath: string, decoder: string, sessionId: string, table: string): string => {
    return `sqlite:${Buffer.from(JSON.stringify({
      databasePath,
      decoder,
      sessionId,
      table,
    })).toString('base64url')}`;
  };

  const rows = (databasePath: string, sql: string): number => {
    const database = new DatabaseSync(databasePath, { readOnly: true });
    const count = Number(database.prepare(sql).get()?.n ?? 0);

    database.close();

    return count;
  };

  test('removes a Goose session with its messages and leaves the others', async () => {
    const { databasePath, roots } = await storeRoots('goose', 'goose');
    const database = new DatabaseSync(databasePath);

    database.exec('CREATE TABLE sessions (id TEXT PRIMARY KEY, name TEXT, working_dir TEXT)');
    database.exec('CREATE TABLE messages (id INTEGER PRIMARY KEY, session_id TEXT, role TEXT)');
    database.prepare('INSERT INTO sessions (id, name, working_dir) VALUES (?, ?, ?)').run('s1', 'One', '/repo');
    database.prepare('INSERT INTO sessions (id, name, working_dir) VALUES (?, ?, ?)').run('s2', 'Two', '/repo');
    database.prepare('INSERT INTO messages (session_id, role) VALUES (?, ?)').run('s1', 'user');
    database.prepare('INSERT INTO messages (session_id, role) VALUES (?, ?)').run('s2', 'user');
    database.close();

    await deleteSession(roots, {
      agent: 'goose',
      filePath: sqliteReference(databasePath, 'goose', 's1', 'messages'),
      actualSessionId: 's1',
    });

    expect(rows(databasePath, "SELECT COUNT(*) AS n FROM sessions WHERE id = 's1'")).toBe(0);
    expect(rows(databasePath, "SELECT COUNT(*) AS n FROM messages WHERE session_id = 's1'")).toBe(0);
    expect(rows(databasePath, 'SELECT COUNT(*) AS n FROM sessions')).toBe(1);
    expect(rows(databasePath, 'SELECT COUNT(*) AS n FROM messages')).toBe(1);
  });

  test('removes an LLM conversation with its responses', async () => {
    const { databasePath, roots } = await storeRoots('llm', 'llm');
    const database = new DatabaseSync(databasePath);

    database.exec('CREATE TABLE conversations (id TEXT PRIMARY KEY, name TEXT)');
    database.exec('CREATE TABLE responses (id INTEGER PRIMARY KEY, conversation_id TEXT, prompt TEXT)');
    database.prepare('INSERT INTO conversations (id, name) VALUES (?, ?)').run('c1', 'One');
    database.prepare('INSERT INTO responses (conversation_id, prompt) VALUES (?, ?)').run('c1', 'hi');
    database.close();

    await deleteSession(roots, {
      agent: 'llm',
      filePath: sqliteReference(databasePath, 'llm', 'c1', 'responses'),
      actualSessionId: 'c1',
    });

    expect(rows(databasePath, 'SELECT COUNT(*) AS n FROM conversations')).toBe(0);
    expect(rows(databasePath, 'SELECT COUNT(*) AS n FROM responses')).toBe(0);
  });

  test('removes a Zed thread', async () => {
    const { databasePath, roots } = await storeRoots('zed', 'zed');
    const database = new DatabaseSync(databasePath);

    database.exec('CREATE TABLE threads (id TEXT PRIMARY KEY, summary TEXT)');
    database.prepare('INSERT INTO threads (id, summary) VALUES (?, ?)').run('t1', 'One');
    database.close();

    await deleteSession(roots, {
      agent: 'zed',
      filePath: sqliteReference(databasePath, 'zed', 't1', 'threads'),
      actualSessionId: 't1',
    });

    expect(rows(databasePath, 'SELECT COUNT(*) AS n FROM threads')).toBe(0);
  });

  test('removes a Cursor composer with every bubble filed under it', async () => {
    const { databasePath, roots } = await storeRoots('cursor', 'cursor');
    const database = new DatabaseSync(databasePath);

    database.exec('CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value TEXT)');

    for (const key of [
      'composerData:one',
      'bubbleId:one:a',
      'bubbleId:one:b',
      'composerData:two',
      'bubbleId:two:a',
    ]) {
      database.prepare('INSERT INTO cursorDiskKV (key, value) VALUES (?, ?)').run(key, '{}');
    }

    database.close();

    await deleteSession(roots, {
      agent: 'cursor',
      filePath: sqliteReference(databasePath, 'cursor', 'one', 'cursorDiskKV'),
      actualSessionId: 'one',
    });

    expect(rows(databasePath, "SELECT COUNT(*) AS n FROM cursorDiskKV WHERE key LIKE '%one%'")).toBe(0);
    expect(rows(databasePath, 'SELECT COUNT(*) AS n FROM cursorDiskKV')).toBe(2);
  });

  test('refuses a reference naming a table rather than a decoded session', async () => {
    const { databasePath, roots } = await storeRoots('crush', 'crush');

    await expect(deleteSession(roots, {
      agent: 'crush',
      filePath: sqliteReference(databasePath, 'table', 's1', 'anything'),
      actualSessionId: 's1',
    })).rejects.toThrow('stay read-only');
  });

  test('refuses a reference carrying no decoder or no session', async () => {
    const { databasePath, roots } = await storeRoots('crush', 'crush');

    await expect(deleteSession(roots, {
      agent: 'crush',
      filePath: `sqlite:${Buffer.from(JSON.stringify({
        databasePath,
        table: 'messages',
      })).toString('base64url')}`,
      actualSessionId: 's1',
    })).rejects.toThrow('not a usable session reference');
  });

  test('refuses a store outside the agent history root and rolls a failure back', async () => {
    const { databasePath, roots } = await storeRoots('crush', 'crush');
    const outsideHome = await mkdtemp(join(tmpdir(), 'mutations-crush-outside-'));
    const outside = join(outsideHome, 'crush.db');
    const database = new DatabaseSync(outside);

    database.exec('CREATE TABLE sessions (id TEXT PRIMARY KEY)');
    database.exec('CREATE TABLE messages (id INTEGER PRIMARY KEY, session_id TEXT)');
    database.prepare('INSERT INTO sessions (id) VALUES (?)').run('s1');
    database.close();

    await expect(deleteSession(roots, {
      agent: 'crush',
      filePath: sqliteReference(outside, 'crush', 's1', 'messages'),
      actualSessionId: 's1',
    })).rejects.toThrow('outside its agent history directory');

    const broken = new DatabaseSync(databasePath);

    broken.exec('CREATE TABLE messages (id INTEGER PRIMARY KEY, session_id TEXT)');
    broken.prepare('INSERT INTO messages (session_id) VALUES (?)').run('s1');
    broken.close();

    await expect(deleteSession(roots, {
      agent: 'crush',
      filePath: sqliteReference(databasePath, 'crush', 's1', 'messages'),
      actualSessionId: 's1',
    })).rejects.toThrow();

    expect(rows(databasePath, 'SELECT COUNT(*) AS n FROM messages')).toBe(1);
  });
});

describe('project deletion beyond a history folder', () => {
  test('takes every session filed under the project with it', async () => {
    const home = await mkdtemp(join(tmpdir(), 'mutations-grok-'));
    const sessions = join(home, '.grok', 'sessions');
    const kept = join(home, '.grok', 'elsewhere');

    await mkdir(sessions, { recursive: true });
    await mkdir(kept, { recursive: true });

    const transcript = (dir: string, name: string, cwd: string): Promise<void> => {
      return writeFile(join(dir, name), JSON.stringify([
        {
          role: 'user',
          content: `asked in ${cwd}`,
          timestamp: 1,
        },
      ]));
    };

    await transcript(sessions, 'a.json', 'sessions');
    await transcript(sessions, 'b.json', 'sessions');
    await transcript(kept, 'c.json', 'elsewhere');

    const roots: AgentRoots = {
      ...resolveAgentPaths({
        env: {},
        home,
        platform: 'linux',
      }),
      grok: [join(home, '.grok')],
    };

    await deleteProject(roots, {
      agent: 'grok',
      projectId: 'sessions',
    });

    await expect(stat(join(sessions, 'a.json'))).rejects.toThrow();
    await expect(stat(join(sessions, 'b.json'))).rejects.toThrow();
    expect((await stat(join(kept, 'c.json'))).isFile()).toBe(true);
  });

  test('deletes a CodeBuddy history folder the way it deletes Claude Code', async () => {
    const home = await mkdtemp(join(tmpdir(), 'mutations-codebuddy-'));
    const projectDir = join(home, '.codebuddy', 'projects', 'p');

    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 's.jsonl'), '{}');

    await deleteProject(
      resolveAgentPaths({
        env: {},
        home,
        platform: 'linux',
      }),
      {
        agent: 'codebuddy',
        projectId: 'p',
      },
    );

    await expect(stat(projectDir)).rejects.toThrow();
  });

  test('refuses an agent with no history directory on this machine', async () => {
    const { roots } = await rootsWithFiles();

    await expect(deleteProject({
      ...roots,
      codebuddy: [],
    }, {
      agent: 'codebuddy',
      projectId: 'p',
    })).rejects.toThrow('no history directory');
  });
});
