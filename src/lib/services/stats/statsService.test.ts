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

import { computeProjectStats } from './statsService';

import type { RawHistoryLine } from '../history/utils/claudeRawUtils';

const newDir = async (): Promise<string> => {
  return mkdtemp(join(tmpdir(), 'stats-'));
};

const writeSession = async (
  dir: string,
  projectId: string,
  fileName: string,
  lines: readonly RawHistoryLine[],
): Promise<void> => {
  const projectDir = join(dir, 'projects', projectId);

  await mkdir(projectDir, { recursive: true });
  await writeFile(
    join(projectDir, fileName),
    lines.map((line) => {
      return JSON.stringify(line);
    }).join('\n'),
    'utf8',
  );
};

const assistantTurn = (model: string, tokens: number, cost = 0): RawHistoryLine => {
  return {
    type: 'assistant',
    uuid: `a-${String(tokens)}-${String(cost)}`,
    timestamp: '2026-07-01T09:00:00Z',
    costUSD: cost,
    durationMs: 100,
    message: {
      role: 'assistant',
      model,
      usage: {
        input_tokens: tokens,
        output_tokens: tokens * 2,
        cache_creation_input_tokens: tokens * 3,
        cache_read_input_tokens: tokens * 4,
      },
      content: [
        {
          type: 'text',
          text: `reply ${String(tokens)}`,
        },
        {
          type: 'tool_use',
          id: `tu-${String(tokens)}`,
          name: 'Bash',
          input: { command: 'ls' },
        },
      ],
    },
  };
};

describe('computeProjectStats', () => {
  test('returns undefined when the project has no sessions', async () => {
    const dir = await newDir();

    await expect(computeProjectStats(dir, 'ghost')).resolves.toBeUndefined();
  });

  test('aggregates totals, models, tools, activity and top sessions', async () => {
    const dir = await newDir();

    await writeSession(dir, 'proj', 'big.jsonl', [
      assistantTurn('claude-sonnet-5', 10, 0.5),
      assistantTurn('claude-sonnet-5', 20),
      {
        type: 'user',
        uuid: 'u1',
        timestamp: '2026-07-01T08:59:00Z',
        message: {
          role: 'user',
          content: 'q',
        },
      },
    ]);
    await writeSession(dir, 'proj', 'small.jsonl', [
      assistantTurn('gpt-5.5', 5),
      {
        type: 'user',
        uuid: 'u2',
        timestamp: '2026-07-02T10:00:00Z',
        message: {
          role: 'user',
          content: 'q',
        },
      },
    ]);

    const stats = await computeProjectStats(dir, 'proj');

    expect(stats?.totals).toMatchObject({
      sessions: 2,
      messages: 3,
      inputTokens: 35,
      outputTokens: 70,
      cacheCreationTokens: 105,
      cacheReadTokens: 140,
      costUsd: 0.5,
      durationMs: 300,
    });
    expect(stats?.models).toEqual([
      {
        model: 'claude-sonnet-5',
        requests: 2,
        inputTokens: 30,
        outputTokens: 60,
      },
      {
        model: 'gpt-5.5',
        requests: 1,
        inputTokens: 5,
        outputTokens: 10,
      },
    ]);
    expect(stats?.tools).toEqual([{
      tool: 'Bash',
      count: 3,
    }]);
    expect(stats?.activity).toEqual([
      {
        date: '2026-07-01',
        messages: 4,
        tokens: 350,
      },
      {
        date: '2026-07-02',
        messages: 1,
        tokens: 0,
      },
    ]);
    expect(stats?.topSessions.map((session) => {
      return session.sessionId;
    })).toEqual(['big', 'small']);
    expect(stats?.topSessions[0]).toMatchObject({
      messages: 2,
      title: 'q',
    });
  });

  test('reports zero token totals for a conversation without assistant turns', async () => {
    const dir = await newDir();

    await writeSession(dir, 'quiet', 'only-user.jsonl', [
      {
        type: 'user',
        uuid: 'u1',
        timestamp: '2026-07-03T00:00:00Z',
        message: {
          role: 'user',
          content: 'hello?',
        },
      },
    ]);

    const stats = await computeProjectStats(dir, 'quiet');

    expect(stats?.totals).toMatchObject({
      sessions: 1,
      messages: 0,
      inputTokens: 0,
    });
    expect(stats?.activity).toEqual([{
      date: '2026-07-03',
      messages: 1,
      tokens: 0,
    }]);
    expect(stats?.models).toEqual([]);
    expect(stats?.tools).toEqual([]);
  });

  test('uses the session summary as the ranking title fallback', async () => {
    const dir = await newDir();

    await writeSession(dir, 'titled', 't.jsonl', [
      {
        type: 'summary',
        summary: 'A recap line',
      },
      assistantTurn('m', 1),
    ]);

    const stats = await computeProjectStats(dir, 'titled');

    expect(stats?.topSessions[0]?.title).toBe('A recap line');
  });
});

describe('Codex project statistics', () => {
  test('loads agent-aware sessions', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stats-codex-'));

    await mkdir(join(dir, 'sessions'), { recursive: true });
    await writeFile(join(dir, 'sessions', 'rollout-s.jsonl'), [
      JSON.stringify({
        type: 'session_meta',
        timestamp: '2026-01-01T00:00:00Z',
        payload: {
          id: 's',
          cwd: '/repo',
        },
      }),
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-01-01T00:00:00Z',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ text: 'Done' }],
        },
      }),
    ].join('\n'));

    expect((await computeProjectStats(dir, '/repo', 'codex'))?.totals.sessions).toBe(1);
  });
});

describe('stats edge inputs', () => {
  test('handles turns without timestamps, models or usage', async () => {
    const dir = await newDir();

    await writeSession(dir, 'edge', 'e.jsonl', [
      {
        type: 'assistant',
        uuid: 'a1',
        message: {
          role: 'assistant',
          content: [],
        },
      },
      assistantTurn('m2', 1),
    ]);

    const stats = await computeProjectStats(dir, 'edge');

    expect(stats?.models.map((model) => {
      return model.model;
    }).sort()).toEqual(['m2', 'unknown']);
    expect(stats?.activity.every((day) => {
      return day.date.length === 10;
    })).toBe(true);
  });
});

describe('tool comparator', () => {
  test('orders multiple tools by descending count', async () => {
    const dir = await newDir();

    await writeSession(dir, 'multi', 'm.jsonl', [
      {
        type: 'assistant',
        uuid: 'a1',
        timestamp: 't',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 't1',
              name: 'Bash',
              input: {},
            },
            {
              type: 'tool_use',
              id: 't2',
              name: 'Read',
              input: {},
            },
            {
              type: 'tool_use',
              id: 't3',
              name: 'Read',
              input: {},
            },
          ],
        },
      },
    ]);

    const stats = await computeProjectStats(dir, 'multi');

    expect(stats?.tools).toEqual([
      {
        tool: 'Read',
        count: 2,
      },
      {
        tool: 'Bash',
        count: 1,
      },
    ]);
  });
});

describe('stats usage defaults', () => {
  test('counts assistant turns without usage as zero-token turns on a counted day', async () => {
    const dir = await newDir();

    await writeSession(dir, 'nousage', 'n.jsonl', [
      {
        type: 'user',
        uuid: 'u0',
        timestamp: '2026-08-08T00:00:00Z',
        message: {
          role: 'user',
          content: 'go',
        },
      },
      {
        type: 'assistant',
        uuid: 'a9',
        timestamp: '2026-08-08T01:00:00Z',
        message: {
          role: 'assistant',
          content: [],
        },
      },
    ]);

    const stats = await computeProjectStats(dir, 'nousage');

    expect(stats?.totals.messages).toBe(1);
    expect(stats?.activity).toEqual([{
      date: '2026-08-08',
      messages: 2,
      tokens: 0,
    }]);
  });
});

describe('structured and SQLite statistics', () => {
  test('loads both non-JSONL agent families', async () => {
    const structured = await newDir();
    const project = join(structured, 'project');

    await mkdir(project);
    await writeFile(join(project, 'chat.json'), JSON.stringify({
      messages: [{
        role: 'assistant',
        content: 'Done',
      }],
    }));

    expect((await computeProjectStats(structured, 'project', 'continue'))?.totals.sessions).toBe(1);

    const sqlite = await newDir();
    const databasePath = join(sqlite, 'history.db');
    const database = new DatabaseSync(databasePath);

    database.exec('CREATE TABLE messages (role TEXT, content TEXT)');
    database.prepare('INSERT INTO messages VALUES (?, ?)').run('assistant', 'Done');
    database.close();

    expect((await computeProjectStats(databasePath, sqlite, 'goose'))?.totals.sessions).toBe(1);
  });
});
