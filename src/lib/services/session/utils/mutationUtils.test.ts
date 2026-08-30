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
} from 'vitest';

import { resolveAgentPaths } from '@services/agents/agentsService';

import {
  deleteProject,
  deleteSession,
  renameSession,
} from './mutationUtils';

import type { AgentRoots } from '@services/agents/agentsService';

interface MutationFixtures {
  readonly roots: AgentRoots;
  readonly claudeFile: string;
  readonly codexFile: string;
}

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
        filePath: claudeFile.replace('.jsonl', '.txt'),
        actualSessionId: 's',
      },
    )).rejects.toThrow('Only JSONL');
  });
});

describe('session deletion by artifact shape', () => {
  test('deletes a Copilot chat but refuses its non-transcript neighbours', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mutations-copilot-'));
    const chat = join(root, 'chat.jsonl');
    const resource = join(root, 'content.txt');

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
    )).rejects.toThrow('Only JSONL session files can be changed.');

    await deleteSession(roots, {
      agent: 'copilot',
      filePath: chat,
      actualSessionId: 'a1b2',
    });

    await expect(stat(chat)).rejects.toThrow();
  });

  test('refuses an agent whose sessions live in a shared database', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mutations-goose-'));
    const databasePath = join(root, 'goose', 'sessions.db');
    const roots: AgentRoots = {
      ...resolveAgentPaths({
        env: {},
        home: root,
        platform: 'linux',
      }),
      goose: [databasePath],
    };

    await expect(deleteSession(
      roots,
      {
        agent: 'goose',
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
  const dataDir = async (): Promise<{ data: string;
    home: string; }> => {
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
    const database = new DatabaseSync(join(data, name));

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
      agent: 'codex',
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

test('rejects mutations for read-only agents', async () => {
  const { roots, claudeFile } = await rootsWithFiles();

  await expect(deleteSession(roots, {
    agent: 'continue',
    filePath: claudeFile,
    actualSessionId: 's',
  })).rejects.toThrow('does not support');
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
