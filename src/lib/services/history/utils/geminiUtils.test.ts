import {
  chmod,
  mkdir,
  mkdtemp,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  listGeminiProjects,
  listGeminiSessions,
  loadGeminiEntries,
  parseGeminiHistory,
} from './geminiUtils';
import { pairToolOutcomes } from './outcomeUtils';

const STAMP = Date.parse('2026-03-01T09:00:00.000Z');
const ISO = new Date(STAMP).toISOString();

const userMessage = {
  id: 'm1',
  type: 'user',
  timestamp: ISO,
  content: 'Rename the helper',
};

const geminiMessage = {
  id: 'm2',
  type: 'gemini',
  timestamp: new Date(STAMP + 1000).toISOString(),
  model: 'gemini-3-pro',
  thoughts: [
    {
      subject: 'Plan',
      description: 'Read the file first.',
    },
    {
      subject: '',
      description: '',
    },
  ],
  content: [{ text: 'Renamed it.' }, 'And ran the tests.'],
  toolCalls: [
    {
      id: 'call-1',
      name: 'read_file',
      args: { file_path: '/repo/helper.ts' },
      status: 'success',
      result: { output: 'export const helper = () => {};' },
    },
    {
      id: 'call-2',
      name: 'shell',
      args: { command: 'pnpm test' },
      status: 'error',
      result: 'exit 1',
    },
    {
      name: 'mystery_tool',
      args: {},
    },
  ],
};

const jsonlSession = [
  JSON.stringify({
    sessionId: 'sess-1',
    projectHash: 'hash',
    startTime: ISO,
  }),
  JSON.stringify(userMessage),
  JSON.stringify({ $set: { lastUpdated: new Date(STAMP + 5000).toISOString() } }),
  JSON.stringify({ $rewindTo: 'm1' }),
  'not json',
  '',
  JSON.stringify(geminiMessage),
  JSON.stringify({
    id: 'm3',
    type: 'info',
    timestamp: new Date(STAMP + 2000).toISOString(),
    content: 'Context window reset.',
  }),
  JSON.stringify({
    id: 'm4',
    type: 'unknown-kind',
    content: 'ignored',
  }),
].join('\n');

describe('parseGeminiHistory', () => {
  test('reads the append-only log, its metadata and every message kind', () => {
    const parsed = parseGeminiHistory(jsonlSession, STAMP);

    expect(parsed?.sessionId).toBe('sess-1');
    expect(parsed?.preview).toBe('Rename the helper');

    const kinds = (parsed?.entries ?? []).map((entry) => {
      return entry.kind;
    });

    expect(kinds).toEqual(['user', 'assistant', 'user', 'system']);
  });

  test('turns thoughts, parts and tool calls into blocks', () => {
    const parsed = parseGeminiHistory(jsonlSession, STAMP);
    const assistant = parsed?.entries[1];

    expect(assistant?.kind).toBe('assistant');

    const blocks = assistant?.kind === 'assistant' ? assistant.blocks : [];

    expect(assistant?.kind === 'assistant' ? assistant.model : undefined).toBe('gemini-3-pro');
    expect(blocks[0]).toEqual({
      blockType: 'thinking',
      thinking: '**Plan**\nRead the file first.',
    });
    expect(blocks[1]).toEqual({
      blockType: 'text',
      text: 'Renamed it.\nAnd ran the tests.',
    });
    expect(blocks.flatMap((block) => {
      return block.blockType === 'tool-use' ? [block.call.name] : [];
    })).toEqual(['Read', 'Bash', 'mystery_tool']);
  });

  test('pairs tool results and marks the failed one', () => {
    const parsed = parseGeminiHistory(jsonlSession, STAMP);
    const outcomes = pairToolOutcomes(parsed?.entries ?? []);

    expect(outcomes.get('call-1')).toMatchObject({
      status: 'ok',
      text: 'export const helper = () => {};',
    });
    expect(outcomes.get('call-2')).toMatchObject({
      status: 'error',
      text: 'exit 1',
    });
    // The third call never reported a result, so it has nothing to pair with.
    expect(outcomes.size).toBe(2);
  });

  test('reads the legacy monolithic object too', () => {
    const parsed = parseGeminiHistory(JSON.stringify({
      sessionId: 'legacy-1',
      messages: [userMessage, 'not an object'],
    }), STAMP);

    expect(parsed?.sessionId).toBe('legacy-1');
    expect(parsed?.entries).toHaveLength(1);
  });

  test('falls back when a session carries no usable records', () => {
    expect(parseGeminiHistory('', STAMP)).toBeUndefined();
    expect(parseGeminiHistory('{"sessionId":"only-meta"}', STAMP)).toBeUndefined();
    expect(parseGeminiHistory(JSON.stringify({
      messages: [{
        id: 'x',
        type: 'info',
        content: '',
      }],
    }), STAMP)).toBeUndefined();
  });

  test('names entries and stamps them when the log omits both', () => {
    const parsed = parseGeminiHistory(JSON.stringify({
      messages: [{
        type: 'user',
        content: 'No id, no timestamp',
      }],
    }), STAMP);

    expect(parsed?.entries[0]).toMatchObject({
      uuid: 'entry-0',
      timestamp: ISO,
    });
  });
});

describe('gemini discovery', () => {
  const writeSession = async (
    root: string,
    project: string,
    file: string,
    body: string,
    projectRoot?: string,
  ): Promise<void> => {
    const dir = join(root, project);

    await mkdir(join(dir, 'chats'), { recursive: true });

    if (projectRoot != null) {
      await writeFile(join(dir, '.project_root'), projectRoot, 'utf8');
    }

    await writeFile(join(dir, 'chats', file), body, 'utf8');
  };

  test('groups sessions by the folder each project points at', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gemini-'));

    await writeSession(root, 'hash-a', 'session-1.jsonl', jsonlSession, '/repo/alpha');
    await writeSession(root, 'hash-b', 'session-2.json', JSON.stringify({
      sessionId: 'sess-2',
      messages: [userMessage],
    }), '/repo/beta');

    const projects = await listGeminiProjects('gemini', [root]);

    expect(projects.map((project) => {
      return project.name;
    }).sort((left, right) => {
      return left.localeCompare(right);
    })).toEqual(['alpha', 'beta']);

    const sessions = await listGeminiSessions('gemini', [root]);

    expect(sessions).toHaveLength(2);
    expect(await listGeminiSessions('gemini', [root], '/repo/alpha')).toHaveLength(1);
  });

  test('falls back to an unknown project when the marker is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gemini-bare-'));

    await writeSession(root, 'hash-c', 'session-3.jsonl', jsonlSession);

    const projects = await listGeminiProjects('gemini', [root]);

    expect(projects).toEqual([expect.objectContaining({
      id: 'unknown',
      name: 'Unknown project',
      actualPath: undefined,
    })]);
  });

  test('ignores files that are not session logs, and unreadable roots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gemini-noise-'));

    await writeSession(root, 'hash-d', 'notes.txt', 'ignored', '/repo/gamma');
    await writeFile(join(root, 'loose-file'), 'ignored', 'utf8');

    expect(await listGeminiSessions('gemini', [root])).toEqual([]);
    expect(await listGeminiProjects('gemini', [join(root, 'missing')])).toEqual([]);
  });

  test('loads entries for one session and refuses a missing file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gemini-load-'));

    await writeSession(root, 'hash-e', 'session-4.jsonl', jsonlSession, '/repo/delta');

    const [session] = await listGeminiSessions('gemini', [root]);

    expect(await loadGeminiEntries(session?.filePath ?? '')).toHaveLength(4);
    expect(await loadGeminiEntries(join(root, 'nope.jsonl'))).toBeUndefined();
  });

  test('counts the file mtime as activity when it outlives the newest entry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gemini-touched-'));
    const touched = new Date(STAMP + 86_400_000);

    await writeSession(root, 'hash-t', 'session-t.jsonl', jsonlSession, '/repo/touched');
    await utimes(join(root, 'hash-t', 'chats', 'session-t.jsonl'), touched, touched);

    const [session] = await listGeminiSessions('gemini', [root]);
    const [project] = await listGeminiProjects('gemini', [root]);

    expect(session?.lastTimestampMs).toBe(touched.getTime());
    expect(project?.lastActivityMs).toBe(touched.getTime());
  });

  test('skips a project whose chats folder is empty of readable logs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gemini-empty-'));

    await mkdir(join(root, 'hash-f', 'chats'), { recursive: true });
    await writeFile(join(root, 'hash-f', 'chats', 'session-5.jsonl'), '', 'utf8');
    await writeFile(join(root, 'hash-f', '.project_root'), '   ', 'utf8');

    expect(await listGeminiSessions('gemini', [root])).toEqual([]);
  });
});

describe('gemini defensive paths', () => {
  test('tolerates records whose fields carry the wrong type', () => {
    const parsed = parseGeminiHistory([
      JSON.stringify({ sessionId: 'sess-odd' }),
      JSON.stringify({
        id: 'u1',
        type: 'user',
        timestamp: 'not a date',
        content: { notAPart: true },
      }),
      JSON.stringify({
        id: 'a1',
        type: 'gemini',
        timestamp: 1_772_000_000_000,
        thoughts: 'not an array',
        content: [{ noText: true }, 42],
        toolCalls: 'not an array',
      }),
      JSON.stringify({
        id: 'a2',
        type: 'gemini',
        content: 'Only prose',
        toolCalls: [
          'not an object',
          {
            args: 'not an object',
            result: { unexpected: 'shape' },
          },
        ],
      }),
    ].join('\n'), STAMP);

    const kinds = (parsed?.entries ?? []).map((entry) => {
      return entry.kind;
    });

    expect(kinds).toEqual(['user', 'assistant', 'user']);

    const outcomes = pairToolOutcomes(parsed?.entries ?? []);
    const only = [...outcomes.values()][0];

    expect(only?.text).toBe(JSON.stringify({ unexpected: 'shape' }));
    expect(parsed?.entries[0]).toMatchObject({ timestamp: ISO });
  });

  test('names an unnamed tool and reads a plain string result', () => {
    const parsed = parseGeminiHistory(JSON.stringify({
      sessionId: 'sess-tool',
      messages: [{
        id: 'a1',
        type: 'gemini',
        content: 'done',
        toolCalls: [{ result: 'plain output' }],
      }],
    }), STAMP);

    const assistant = parsed?.entries[0];
    const blocks = assistant?.kind === 'assistant' ? assistant.blocks : [];

    expect(blocks.flatMap((block) => {
      return block.blockType === 'tool-use' ? [block.call.name] : [];
    })).toEqual(['Tool']);
    expect([...pairToolOutcomes(parsed?.entries ?? []).values()][0]?.text).toBe('plain output');
  });

  test('keeps injected context out of the visible user text', () => {
    const parsed = parseGeminiHistory(JSON.stringify({
      sessionId: 'sess-inject',
      messages: [{
        id: 'u1',
        type: 'user',
        content: 'Ship it\n<environment_context>hidden</environment_context>',
      }],
    }), STAMP);

    expect(parsed?.entries[0]).toMatchObject({
      text: 'Ship it',
      injectedText: '<environment_context>hidden</environment_context>',
    });
  });

  test('drops an assistant turn that carries nothing to show', () => {
    const parsed = parseGeminiHistory(JSON.stringify({
      sessionId: 'sess-empty',
      messages: [
        {
          id: 'a1',
          type: 'gemini',
          content: '',
        },
        {
          id: 'u1',
          type: 'user',
          content: 'still here',
        },
      ],
    }), STAMP);

    expect((parsed?.entries ?? []).map((entry) => {
      return entry.kind;
    })).toEqual(['user']);
  });

  test('uses the file stamp when no message carries a usable one', () => {
    const parsed = parseGeminiHistory(JSON.stringify({
      sessionId: 'sess-nostamp',
      messages: [{
        id: 'u1',
        type: 'user',
        content: 'no timestamp anywhere',
      }],
    }), STAMP);

    expect(parsed?.firstTimestampMs).toBe(STAMP);
    expect(parsed?.lastTimestampMs).toBe(STAMP);
  });

  test('leaves the preview empty when no user turn has text', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gemini-nopreview-'));

    await mkdir(join(root, 'hash-g', 'chats'), { recursive: true });
    await writeFile(join(root, 'hash-g', 'chats', 'session-6.jsonl'), JSON.stringify({
      id: 'a1',
      type: 'gemini',
      content: 'assistant only',
    }), 'utf8');

    const [session] = await listGeminiSessions('gemini', [root]);

    expect(session?.preview).toBeUndefined();
  });
});

describe('gemini remaining edge paths', () => {
  test('skips a project folder with no chats and a session file it cannot read', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gemini-edge-'));

    await mkdir(join(root, 'no-chats'), { recursive: true });

    const good = join(root, 'hash-h');

    await mkdir(join(good, 'chats'), { recursive: true });
    await writeFile(join(good, '.project_root'), '/repo/epsilon', 'utf8');
    await writeFile(join(good, 'chats', 'session-7.jsonl'), jsonlSession, 'utf8');

    const locked = join(good, 'chats', 'session-locked.jsonl');

    await writeFile(locked, jsonlSession, 'utf8');
    await chmod(locked, 0o000);

    const sessions = await listGeminiSessions('gemini', [root]);

    await chmod(locked, 0o644);

    expect(sessions).toHaveLength(1);
  });

  test('treats a blank project marker as no project at all', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gemini-blank-'));
    const dir = join(root, 'hash-i');

    await mkdir(join(dir, 'chats'), { recursive: true });
    await writeFile(join(dir, '.project_root'), '   \n', 'utf8');
    await writeFile(join(dir, 'chats', 'session-8.jsonl'), jsonlSession, 'utf8');

    const [session] = await listGeminiSessions('gemini', [root]);

    expect(session?.projectId).toBe('unknown');
    expect(session?.cwd).toBeUndefined();
  });

  test('ignores log lines that are neither metadata nor a message', () => {
    const parsed = parseGeminiHistory([
      JSON.stringify({ sessionId: 'sess-noise' }),
      JSON.stringify({ unrelated: 'record' }),
      JSON.stringify({
        id: 'u1',
        type: 'user',
        content: 'still parsed',
      }),
    ].join('\n'), STAMP);

    expect(parsed?.entries).toHaveLength(1);
  });

  test('reports a null tool result as no text rather than the string null', () => {
    const parsed = parseGeminiHistory(JSON.stringify({
      sessionId: 'sess-null',
      messages: [{
        id: 'a1',
        type: 'gemini',
        content: 'done',
        toolCalls: [{
          id: 'call-null',
          name: 'shell',
          result: null,
        }],
      }],
    }), STAMP);

    expect(pairToolOutcomes(parsed?.entries ?? []).get('call-null')?.text).toBeUndefined();
  });
});
