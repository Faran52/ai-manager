import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { expect, test } from 'vitest';

import {
  listAgentProjects,
  listAgentSessions,
  loadAgentEntries,
  resolveAgentPaths,
} from './agentsService';

import type { AgentId } from '@config/agents';
import type { AgentRoots } from './agentsService';

const rootsWith = (
  home: string,
  overrides: Partial<Record<AgentId, readonly string[]>>,
): AgentRoots => {
  return {
    ...resolveAgentPaths({
      env: {},
      home,
    }),
    ...overrides,
  } as AgentRoots;
};

test('aggregates projects and dispatches session discovery by agent', async () => {
  const home = await mkdtemp(join(tmpdir(), 'agents-home-'));
  const claude = join(home, 'claude-root');
  const codex = join(home, 'codex-root');

  await mkdir(join(claude, 'projects', 'p'), { recursive: true });
  await writeFile(join(claude, 'projects', 'p', 's.jsonl'), JSON.stringify({
    type: 'user',
    uuid: 'u',
    timestamp: '2026-01-01T00:00:00Z',
    message: {
      role: 'user',
      content: 'Hi',
    },
  }));
  await mkdir(join(codex, 'sessions'), { recursive: true });
  await writeFile(join(codex, 'sessions', 'rollout-c.jsonl'), [
    JSON.stringify({
      type: 'session_meta',
      timestamp: '2026-01-02T00:00:00Z',
      payload: {
        id: 'c',
        cwd: '/c',
      },
    }),
    JSON.stringify({
      type: 'response_item',
      timestamp: '2026-01-02T00:00:00Z',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ text: 'Codex' }],
      },
    }),
  ].join('\n'));

  const roots = rootsWith(home, {
    claude: [claude],
    codex: [codex],
  });
  const projects = await listAgentProjects(roots);

  expect(projects.map((project) => {
    return project.agent;
  })).toEqual(['codex', 'claude']);
  expect(await listAgentSessions(roots, 'claude', 'p')).toHaveLength(1);
  expect(await listAgentSessions(roots, 'codex', '/c')).toHaveLength(1);
  expect(await listAgentSessions(roots, 'codex')).toHaveLength(1);
});

test('routes compatible, structured, SQLite, and OpenCode agent families', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-families-'));
  const codebuddy = join(root, 'codebuddy');
  const interpreter = join(root, 'interpreter');
  const continueDir = join(root, 'continue');
  const sqlitePath = join(root, 'goose.db');
  const openCodeDb = join(root, 'opencode', 'opencode.db');

  await mkdir(join(codebuddy, 'projects', 'buddy'), { recursive: true });
  await writeFile(join(codebuddy, 'projects', 'buddy', 'b.jsonl'), JSON.stringify({
    type: 'user',
    uuid: 'b',
    timestamp: '2026-01-01T00:00:00Z',
    message: {
      role: 'user',
      content: 'Buddy',
    },
  }));
  await mkdir(join(interpreter, 'sessions'), { recursive: true });
  await writeFile(join(interpreter, 'sessions', 'rollout-i.jsonl'), [
    JSON.stringify({
      type: 'session_meta',
      timestamp: '2026-01-01T00:00:00Z',
      payload: {
        id: 'i',
        cwd: '/i',
      },
    }),
    JSON.stringify({
      type: 'response_item',
      timestamp: '2026-01-01T00:00:00Z',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ text: 'Interpreter' }],
      },
    }),
  ].join('\n'));
  await mkdir(join(continueDir, 'project'), { recursive: true });
  await writeFile(join(continueDir, 'project', 'chat.json'), JSON.stringify({
    messages: [{
      role: 'user',
      content: 'Continue',
    }],
  }));

  const database = new DatabaseSync(sqlitePath);

  database.exec('CREATE TABLE messages (role TEXT, content TEXT)');
  database.prepare('INSERT INTO messages VALUES (?, ?)').run('user', 'Goose');
  database.close();

  await mkdir(join(root, 'opencode'), { recursive: true });

  const openCode = new DatabaseSync(openCodeDb);
  const sessionStart = Date.parse('2026-01-03T00:00:00Z');

  openCode.exec(`
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
  openCode.prepare(
    'INSERT INTO session VALUES (?, ?, ?, ?, ?, ?)',
  ).run('ses_1', 'OpenCode chat', '/oc/project', null, sessionStart, sessionStart + 5_000);
  openCode.prepare(
    'INSERT INTO message VALUES (?, ?, ?, ?)',
  ).run('msg_1', 'ses_1', sessionStart, JSON.stringify({ role: 'user' }));
  openCode.prepare(
    'INSERT INTO part VALUES (?, ?, ?, ?, ?)',
  ).run('part_1', 'msg_1', 'ses_1', sessionStart, JSON.stringify({
    type: 'text',
    text: 'Hello OpenCode',
  }));
  openCode.prepare(
    'INSERT INTO message VALUES (?, ?, ?, ?)',
  ).run('msg_2', 'ses_1', sessionStart + 1_000, JSON.stringify({ role: 'assistant' }));
  openCode.prepare(
    'INSERT INTO part VALUES (?, ?, ?, ?, ?)',
  ).run('part_2', 'msg_2', 'ses_1', sessionStart + 1_000, JSON.stringify({
    type: 'tool',
    tool: 'bash',
    callID: 'call_1',
    state: {
      status: 'completed',
      input: { command: 'ls' },
      output: 'file.txt',
    },
  }));
  openCode.prepare(
    'INSERT INTO part VALUES (?, ?, ?, ?, ?)',
  ).run('part_3', 'msg_2', 'ses_1', sessionStart + 2_000, JSON.stringify({
    type: 'reasoning',
    text: 'Thinking it through',
  }));
  openCode.close();

  const roots = rootsWith(root, {
    claude: [join(root, 'missing-claude')],
    codex: [join(root, 'missing-codex')],
    codebuddy: [codebuddy],
    openinterpreter: [interpreter],
    continue: [continueDir],
    goose: [sqlitePath],
    opencode: [join(root, 'opencode')],
  });
  const projects = await listAgentProjects(roots);
  const byAgent = new Map(projects.map((project) => {
    return [project.agent, project];
  }));
  const continueProject = byAgent.get('continue');
  const gooseProject = byAgent.get('goose');

  expect(projects.map((project) => {
    return project.agent;
  })).toEqual(expect.arrayContaining([
    'codebuddy', 'openinterpreter', 'continue', 'goose', 'opencode',
  ]));
  expect(await listAgentSessions(roots, 'codebuddy', 'buddy')).toMatchObject([{ agent: 'codebuddy' }]);
  expect(await listAgentSessions(roots, 'openinterpreter', '/i')).toMatchObject([{ agent: 'openinterpreter' }]);

  const structured = await listAgentSessions(roots, 'continue', continueProject?.id ?? '');
  const sqlite = await listAgentSessions(roots, 'goose', gooseProject?.id ?? '');
  const openCodeSessions = await listAgentSessions(roots, 'opencode', '/oc/project');

  expect(await loadAgentEntries(structured[0]?.filePath ?? '', 'continue', [continueDir])).toHaveLength(1);
  expect(await loadAgentEntries(sqlite[0]?.filePath ?? '', 'goose', [sqlitePath])).toHaveLength(1);
  expect(await loadAgentEntries('/missing', 'claude', [...roots.claude])).toBeUndefined();
  expect(await loadAgentEntries('/missing', 'codex', [...roots.codex])).toBeUndefined();
  await expect(loadAgentEntries(root, 'codex', [root])).resolves.toBeUndefined();

  expect(openCodeSessions).toHaveLength(1);
  expect(openCodeSessions[0]).toMatchObject({
    title: 'OpenCode chat',
    projectId: '/oc/project',
    cwd: '/oc/project',
  });

  const openCodeEntries = await loadAgentEntries(openCodeSessions[0]?.filePath ?? '', 'opencode', [root]);

  expect(openCodeEntries).toEqual([
    {
      kind: 'user',
      uuid: 'msg_1',
      timestamp: new Date(sessionStart).toISOString(),
      sidechain: false,
      meta: false,
      text: 'Hello OpenCode',
      outcomes: [],
    },
    {
      kind: 'assistant',
      uuid: 'msg_2',
      timestamp: new Date(sessionStart + 1_000).toISOString(),
      sidechain: false,
      blocks: [
        {
          blockType: 'tool-use',
          call: {
            id: 'call_1',
            name: 'bash',
            input: {
              kind: 'bash',
              command: 'ls',
              description: undefined,
            },
          },
        },
        {
          blockType: 'thinking',
          thinking: 'Thinking it through',
        },
      ],
    },
    {
      kind: 'user',
      uuid: 'msg_2-outcomes',
      timestamp: new Date(sessionStart + 1_000).toISOString(),
      sidechain: false,
      meta: true,
      text: '',
      outcomes: [{
        toolUseId: 'call_1',
        status: 'ok',
        text: 'file.txt',
        images: [],
      }],
    },
  ]);
});

test('loadAgentEntries refuses structured files outside their roots', async () => {
  const outside = await mkdtemp(join(tmpdir(), 'agent-outside-'));
  const file = join(outside, 'chat.json');

  await writeFile(file, JSON.stringify({
    messages: [{
      role: 'user',
      content: 'x',
    }],
  }));

  const root = await mkdtemp(join(tmpdir(), 'agent-root-'));

  await expect(loadAgentEntries(file, 'continue', [root])).resolves.toBeUndefined();
});

test('loadAgentEntries refuses copilot journals outside their roots', async () => {
  const outside = await mkdtemp(join(tmpdir(), 'copilot-outside-'));
  const file = join(outside, 'chat.jsonl');

  await writeFile(file, JSON.stringify({
    kind: 0,
    v: {
      sessionId: 'outside',
      requests: [{
        requestId: 'r0',
        timestamp: Date.parse('2026-02-01T10:00:00.000Z'),
        message: { text: 'Prompt' },
        response: [{ value: 'Reply' }],
      }],
    },
  }));

  const root = await mkdtemp(join(tmpdir(), 'copilot-root-'));

  await expect(loadAgentEntries(file, 'copilot', [root])).resolves.toBeUndefined();
});
