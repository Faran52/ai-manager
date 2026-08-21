import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
} from 'vitest';

import { agentOptions } from '@config/agents';

import { resolveAgentPaths } from '../agents/agentsService';

import { searchAgentHistory } from './searchService';

import type { AgentRoots } from '../agents/agentsService';
import type { RawHistoryLine } from '../history/utils/claudeRawUtils';

const claudeRoots = (root: string): AgentRoots => {
  return agentOptions.reduce<AgentRoots>((map, option) => {
    return {
      ...map,
      [option.id]: option.id === 'claude' ? [root] : [],
    };
  }, resolveAgentPaths({
    env: {},
    home: root,
  }));
};

const searchRoots = (root: string): AgentRoots => {
  return {
    ...resolveAgentPaths({
      env: {},
      home: root,
    }),
    claude: [join(root, 'claude')],
    codex: [join(root, 'codex')],
    continue: [root],
  };
};

const newDir = async (): Promise<string> => {
  return mkdtemp(join(tmpdir(), 'search-'));
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

describe('searchAgentHistory', () => {
  test('returns nothing for a blank query', async () => {
    const dir = await newDir();

    await expect(searchAgentHistory(claudeRoots(dir), '   ')).resolves.toEqual({
      hits: [],
      truncated: false,
    });
  });

  test('returns empty when the projects root is missing', async () => {
    const dir = await newDir();

    await expect(searchAgentHistory(claudeRoots(dir), 'anything')).resolves.toEqual({
      hits: [],
      truncated: false,
    });
  });

  test('matches user text with padded snippets and role attribution', async () => {
    const dir = await newDir();

    await writeSession(dir, 'proj', 's1.jsonl', [
      {
        type: 'user',
        uuid: 'u1',
        timestamp: '2026-05-01T08:00:00Z',
        message: {
          role: 'user',
          content: 'please refactor the widget module today',
        },
      },
    ]);

    const { hits, truncated } = await searchAgentHistory(claudeRoots(dir), 'WIDGET');

    expect(truncated).toBe(false);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      projectId: 'proj',
      sessionId: 's1',
      role: 'user',
      match: 'widget',
      timestampMs: Date.parse('2026-05-01T08:00:00Z'),
    });
    expect(hits[0]?.before.startsWith('please refactor the')).toBe(true);
  });

  test('matches tool output carried on user lines', async () => {
    const dir = await newDir();

    await writeSession(dir, 'proj', 's1.jsonl', [
      {
        type: 'user',
        uuid: 'u1',
        timestamp: 't1',
        message: {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: 'tu1',
            content: '',
          }],
        },
        toolUseResult: { stdout: 'deployed to eu-west-1 successfully' },
      },
    ]);

    const { hits } = await searchAgentHistory(claudeRoots(dir), 'eu-west-1');

    expect(hits[0]).toMatchObject({
      role: 'user',
      match: 'eu-west-1',
    });
  });

  test('matches assistant thinking and text blocks', async () => {
    const dir = await newDir();

    await writeSession(dir, 'proj', 's1.jsonl', [
      {
        type: 'assistant',
        uuid: 'a1',
        timestamp: 't2',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'thinking',
              thinking: 'the cache stampede explains latency',
            },
            {
              type: 'text',
              text: 'Here is my conclusion.',
            },
          ],
        },
      },
    ]);

    const thinkingHit = await searchAgentHistory(claudeRoots(dir), 'stampede');
    const textHit = await searchAgentHistory(claudeRoots(dir), 'conclusion');

    expect(thinkingHit.hits[0]).toMatchObject({ role: 'assistant' });
    expect(textHit.hits[0]).toMatchObject({ role: 'assistant' });
  });

  test('matches system notices and summaries', async () => {
    const dir = await newDir();

    await writeSession(dir, 'proj', 's1.jsonl', [
      {
        type: 'user',
        uuid: 'u0',
        timestamp: '2026-05-01T08:00:00Z',
        message: {
          role: 'user',
          content: 'kickoff',
        },
      },
      {
        type: 'system',
        uuid: 's1',
        timestamp: 't3',
        subtype: 'compact_boundary',
      },
      {
        type: 'summary',
        summary: 'session about kubernetes ingress',
      },
    ]);

    const systemHit = (await searchAgentHistory(claudeRoots(dir), 'boundary')).hits[0];
    const summaryHit = (await searchAgentHistory(claudeRoots(dir), 'kubernetes')).hits[0];

    expect(systemHit?.role).toBe('system');
    expect(summaryHit?.role).toBe('summary');
    expect(summaryHit?.timestampMs).toBe(0);
  });

  test('scopes to one project when a project id is given', async () => {
    const dir = await newDir();

    await writeSession(dir, 'alpha', 'a.jsonl', [
      {
        type: 'user',
        uuid: 'u1',
        timestamp: 't1',
        message: {
          role: 'user',
          content: 'needle here',
        },
      },
    ]);
    await writeSession(dir, 'beta', 'b.jsonl', [
      {
        type: 'user',
        uuid: 'u2',
        timestamp: 't2',
        message: {
          role: 'user',
          content: 'needle there',
        },
      },
    ]);

    const scoped = await searchAgentHistory(claudeRoots(dir), 'needle', 'beta');

    expect(scoped.hits).toHaveLength(1);
    expect(scoped.hits[0]?.projectId).toBe('beta');
  });

  test('flags truncation once the global result cap is reached', async () => {
    const dir = await newDir();
    const turns = Array.from({ length: 6 }, (_, index) => {
      return {
        type: 'user',
        uuid: `u${String(index)}`,
        timestamp: 't1',
        message: {
          role: 'user',
          content: `hit number ${String(index)} needle`,
        },
      };
    });

    await writeSession(dir, 'proj', 's1.jsonl', turns);

    const { hits, truncated } = await searchAgentHistory(claudeRoots(dir), 'needle');

    expect(hits.length).toBeLessThan(6);
    expect(truncated).toBe(true);
  });
});

describe('search truncation across many files', () => {
  test('stops once the global cap of matches is exceeded', async () => {
    const dir = await newDir();

    for (let fileIndex = 0; fileIndex < 105; fileIndex += 1) {
      await writeSession(dir, 'bulk', `f${String(fileIndex)}.jsonl`, [
        {
          type: 'user',
          uuid: `u${String(fileIndex)}`,
          timestamp: 't',
          message: {
            role: 'user',
            content: 'needle here',
          },
        },
        {
          type: 'assistant',
          uuid: `a${String(fileIndex)}`,
          timestamp: 't',
          message: {
            role: 'assistant',
            content: [{
              type: 'text',
              text: 'needle too',
            }],
          },
        },
      ]);
    }

    const { hits, truncated } = await searchAgentHistory(claudeRoots(dir), 'needle');

    expect(hits.length).toBeLessThanOrEqual(200);
    expect(truncated).toBe(true);
  });
});

describe('searchable source selection', () => {
  test('prefers command labels over raw tagged text', async () => {
    const dir = await newDir();

    await writeSession(dir, 'cmd', 'c.jsonl', [
      {
        type: 'user',
        uuid: 'u1',
        timestamp: 't',
        message: {
          role: 'user',
          content: '<command-name>/deploy</command-name>\n<command-args>prod</command-args>',
        },
      },
    ]);

    const { hits } = await searchAgentHistory(claudeRoots(dir), '/deploy prod');

    expect(hits.at(0)?.match).toBe('/deploy prod');
  });
});

describe('searchable extras coverage', () => {
  test('finds matches inside stdout and stderr extras', async () => {
    const dir = await newDir();

    await writeSession(dir, 'x', 'x.jsonl', [
      {
        type: 'user',
        uuid: 'u1',
        timestamp: 't',
        toolUseResult: { stderr: 'segfault in module zebra' },
        message: {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: 'tu1',
            content: '',
          }],
        },
      },

      {
        type: 'user',
        uuid: 'u2',
        timestamp: 't',
        message: {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: 'tu2',
            content: 'stdout has yak shaving',
          }],
        },
      },
    ]);

    expect((await searchAgentHistory(claudeRoots(dir), 'zebra')).hits.at(0)?.role).toBe('user');
    expect((await searchAgentHistory(claudeRoots(dir), 'yak')).hits).toHaveLength(1);
  });
});

describe('assistant block kinds during search', () => {
  test('reads thinking text while skipping tool blocks', async () => {
    const dir = await newDir();

    await writeSession(dir, 'kinds', 'k.jsonl', [
      {
        type: 'assistant',
        uuid: 'a1',
        timestamp: 't',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'thinking',
              thinking: 'musing about quokkas',
            },
            {
              type: 'tool_use',
              id: 'tu9',
              name: 'Bash',
              input: { command: 'echo quokkas' },
            },
            {
              type: 'text',
              text: 'plain words',
            },
          ],
        },
      },
    ]);

    expect((await searchAgentHistory(claudeRoots(dir), 'quokkas')).hits.at(0)?.role).toBe('assistant');
    expect((await searchAgentHistory(claudeRoots(dir), 'plain words')).hits).toHaveLength(1);
  });
});

describe('agent-aware search', () => {
  test('searches structured agents and handles blank, scoped, and capped results', async () => {
    const root = await newDir();
    const project = join(root, 'project');

    await mkdir(project);
    await writeFile(join(project, 'chat.json'), JSON.stringify({
      messages: Array.from({ length: 6 }, (_, index) => {
        return {
          role: 'user',
          content: `agent needle ${String(index)}`,
        };
      }),
    }));

    const roots = searchRoots(root);

    await expect(searchAgentHistory(roots, ' ')).resolves.toEqual({
      hits: [],
      truncated: false,
    });
    await expect(searchAgentHistory(roots, 'needle', 'missing')).resolves.toEqual({
      hits: [],
      truncated: false,
    });

    const outcome = await searchAgentHistory(roots, 'needle');

    expect(outcome.truncated).toBe(true);
    expect(outcome.hits[0]).toMatchObject({
      agent: 'continue',
      projectId: 'project',
    });
  });

  test('stops at the global agent-search result cap', async () => {
    const root = await newDir();

    await Promise.all(Array.from({ length: 201 }, async (_, index) => {
      const project = join(root, String(index));

      await mkdir(project);
      await writeFile(join(project, 'chat.json'), JSON.stringify({
        messages: [{
          role: 'user',
          content: 'global needle',
        }],
      }));
    }));

    const outcome = await searchAgentHistory(searchRoots(root), 'needle');

    expect(outcome).toMatchObject({ truncated: true });
    expect(outcome.hits).toHaveLength(200);
  }, 15_000);
});
