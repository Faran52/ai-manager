import {
  chmod,
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

import {
  listCopilotProjects,
  listCopilotSessions,
  loadCopilotEntries,
  parseCopilotHistory,
} from './copilotUtils';
import { pairToolOutcomes } from './outcomeUtils';

import type { JsonValue } from '@utils/jsonUtils';

interface FixturePart {
  readonly text?: string;
  readonly value?: string | number;
}

interface FixtureToolData {
  readonly commandLine?: {
    readonly forDisplay?: string;
    readonly original?: string;
    readonly toolEdited?: string;
  };
  readonly todoList?: readonly {
    readonly id?: string;
    readonly status?: string;
    readonly title?: string;
  }[];
}

interface FixtureItem {
  readonly content?: FixturePart;
  readonly edits?: readonly JsonValue[];
  readonly id?: string;
  readonly invocationMessage?: string | FixturePart;
  readonly isComplete?: boolean;
  readonly kind?: string;
  readonly name?: string;
  readonly pastTenseMessage?: string | FixturePart;
  readonly presentation?: string;
  readonly resultDetails?: readonly {
    readonly external?: string;
    readonly path?: string;
  }[];
  readonly toolCallId?: string;
  readonly toolId?: string;
  readonly toolSpecificData?: FixtureToolData;
  readonly uri?: { readonly path?: string };
  readonly value?: string;
}

interface FixtureRequest {
  readonly completionTokens?: number;
  readonly copilotCredits?: number;
  readonly elapsedMs?: number;
  readonly message?: FixturePart;
  readonly modelId?: string;
  readonly promptTokens?: number;
  readonly requestId?: string;
  readonly response?: readonly FixtureItem[];
  readonly responseTimestamp?: number;
  readonly result?: {
    readonly metadata?: {
      readonly resolvedModel?: string;
    };
  };
  readonly timestamp?: number;
}

interface FixtureSnapshot {
  readonly customTitle?: string;
  readonly requests?: readonly FixtureRequest[];
  readonly sessionId?: string;
  readonly version?: number;
}

const STAMP = Date.parse('2026-02-01T10:00:00.000Z');

const snapshot = (data: FixtureSnapshot): string => {
  return JSON.stringify({
    kind: 0,
    v: data,
  });
};

const setPatch = (path: readonly (string | number)[], value: JsonValue): string => {
  return JSON.stringify({
    kind: 1,
    k: path,
    v: value,
  });
};

const appendPatch = (path: readonly (string | number)[], value: JsonValue): string => {
  return JSON.stringify({
    kind: 2,
    k: path,
    v: value,
  });
};

const journal = (...lines: readonly string[]): string => {
  return lines.join('\n');
};

describe('parseCopilotHistory', () => {
  test('replays set patches and appends rebuild turn records across nested paths', () => {
    const parsed = parseCopilotHistory(journal(
      setPatch(['requests', 0, 'promptTokens'], 999),
      snapshot({
        version: 3,
        sessionId: 'session-1',
        requests: [{
          requestId: 'r0',
          timestamp: STAMP,
          responseTimestamp: STAMP + 1,
          message: { text: 'First question' },
          response: [],
        }],
      }),
      '{bad',
      '',
      'null',
      '[1]',
      '42',
      JSON.stringify({
        kind: 99,
        k: ['requests'],
        v: [],
      }),
      JSON.stringify({ kind: 1 }),
      JSON.stringify({
        kind: 1,
        k: 'requests',
      }),
      JSON.stringify({
        kind: 1,
        k: ['hasPendingEdits'],
        v: false,
      }),
      JSON.stringify({
        kind: 1,
        k: ['ghost', 'x'],
        v: true,
      }),
      JSON.stringify({
        kind: 1,
        k: ['requests', 0],
        v: {},
      }),
      JSON.stringify({
        kind: 1,
        k: ['requests', 4, 'promptTokens'],
        v: 5,
      }),
      JSON.stringify({
        kind: 1,
        k: ['requests', -1, 'promptTokens'],
        v: 6,
      }),
      JSON.stringify({
        kind: 1,
        k: ['requests', 0.5, 'promptTokens'],
        v: 7,
      }),
      JSON.stringify({
        kind: 1,
        k: ['requests', '0', 'promptTokens'],
        v: 8,
      }),
      JSON.stringify({
        kind: 1,
        k: ['requests', 0, 'response'],
        v: 'scalar-response',
      }),
      JSON.stringify({
        kind: 1,
        k: ['requests', 0, 'completionTokens'],
        v: 'soon',
      }),
      JSON.stringify({
        kind: 1,
        k: ['requests', 0, 'copilotCredits'],
        v: null,
      }),
      JSON.stringify({
        kind: 1,
        k: ['requests', 0, 'modelId'],
        v: 42,
      }),
      JSON.stringify({
        kind: 2,
        k: ['followups'],
        v: [{ noop: true }],
      }),
      JSON.stringify({
        kind: 2,
        k: ['requests'],
        v: 'not-an-array',
      }),
      setPatch(['requests', 0, 'promptTokens'], 111),
      setPatch(['requests', 0, 'completionTokens'], 222),
      setPatch(['requests', 0, 'copilotCredits'], 12.5),
      setPatch(['requests', 0, 'elapsedMs'], 88_000),
      setPatch(['requests', 0, 'result'], { metadata: { resolvedModel: 'kimi-k3' } }),
      appendPatch(['requests'], [{
        timestamp: STAMP + 100,
        requestId: 'r1',
        message: { text: 'Second question' },
      }]),
      setPatch(['requests', 1, 'modelId'], 'copilot/kimi-k3'),
      setPatch(['requests', 1, 'responseTimestamp'], STAMP + 150),
      appendPatch(['requests', 1, 'response'], [
        {
          kind: 'thinking',
          value: 'Thinking about it.',
        },
      ]),
      JSON.stringify({
        kind: 2,
        k: ['requests', 1, 'response'],
        v: 'scalar',
      }),
      JSON.stringify({
        kind: 2,
        k: ['requests', 9, 'response'],
        v: [{ value: 'ghost' }],
      }),
    ));

    expect(parsed).toMatchObject({
      sessionId: 'session-1',
      firstTimestampMs: STAMP,
      lastTimestampMs: STAMP + 150,
    });
    expect(parsed?.entries).toHaveLength(4);
    expect(parsed?.entries[0]).toMatchObject({
      kind: 'user',
      uuid: 'r0',
      text: 'First question',
    });
    expect(parsed?.entries[1]).toMatchObject({
      kind: 'assistant',
      uuid: 'r0',
      model: 'kimi-k3',
      costUsd: 12.5,
      durationMs: 88_000,
      usage: {
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        inputTokens: 111,
        outputTokens: 222,
      },
      blocks: [],
    });
    expect(parsed?.entries[2]).toMatchObject({
      kind: 'user',
      uuid: 'r1',
      text: 'Second question',
    });
    expect(parsed?.entries[3]).toMatchObject({
      kind: 'assistant',
      uuid: 'r1',
      model: 'copilot/kimi-k3',
      blocks: [{
        blockType: 'thinking',
        thinking: 'Thinking about it.',
      }],
    });
  });

  test('merges progressive thinking runs and interleaved prose into ordered blocks', () => {
    const parsed = parseCopilotHistory(snapshot({
      requests: [{
        requestId: 'r0',
        timestamp: STAMP,
        message: { text: 'Show me' },
        response: [
          {
            kind: 'thinking',
            value: 'The user wants',
          },
          {
            kind: 'thinking',
            value: 'The user wants me to refine the README',
          },
          {
            kind: 'thinking',
            value: '',
          },
          { value: 'Intro sentence. ' },
          {
            kind: 'toolInvocationSerialized',
            presentation: 'hidden',
            invocationMessage: { value: 'Updated todo list' },
            isComplete: true,
            toolCallId: 'tc-1',
            toolId: 'manage_todo_list',
            toolSpecificData: { todoList: [] },
          },
          { value: '\n```diff\n-old\n+new\n```\n' },
          {
            id: 'undo-1',
            kind: 'undoStop',
          },
          {
            kind: 'codeblockUri',
            uri: { path: '/repo/README.md' },
          },
          {
            kind: 'textEditGroup',
            edits: [],
          },
          {
            kind: 'inlineReference',
            name: 'README.md',
          },
          {
            kind: 'progressTaskSerialized',
            content: { value: 'Optimized tool selection' },
          },
          { kind: 'mcpServersStarting' },
          {
            kind: 'thinking',
            value: 'Second thought starts',
          },
          {
            kind: 'thinking',
            value: 'Second thought continues here',
          },
        ],
      }],
    }));

    expect(parsed?.entries).toHaveLength(3);
    expect(parsed?.entries[1]).toMatchObject({
      kind: 'assistant',
      blocks: [
        {
          blockType: 'thinking',
          thinking: 'The user wants me to refine the README',
        },
        {
          blockType: 'text',
          text: 'Intro sentence. ',
        },
        {
          blockType: 'tool-use',
          call: {
            id: 'tc-1',
            name: 'TodoWrite',
          },
        },
        {
          blockType: 'text',
          text: '\n```diff\n-old\n+new\n```\n',
        },
        {
          blockType: 'thinking',
          thinking: 'Second thought starts\n\nSecond thought continues here',
        },
      ],
    });
    expect(parsed?.entries[2]).toMatchObject({
      kind: 'user',
      meta: true,
      text: '',
    });

    const outcomes = pairToolOutcomes(parsed?.entries ?? []);

    expect(outcomes.get('tc-1')).toMatchObject({
      status: 'ok',
      text: 'Updated todo list',
    });
  });

  test('keeps only the newest overlapping thought and drops empty or shrinking fragments', () => {
    const superseded = parseCopilotHistory(snapshot({
      requests: [{
        requestId: 'rs',
        timestamp: STAMP,
        response: [
          {
            kind: 'thinking',
            value: 'Long thought that survives',
          },
          {
            kind: 'thinking',
            value: 'Long',
          },
        ],
      }],
    }));

    expect(superseded?.entries[0]).toMatchObject({
      kind: 'assistant',
      blocks: [{
        blockType: 'thinking',
        thinking: 'Long thought that survives',
      }],
    });

    const whitespaceOnly = parseCopilotHistory(snapshot({
      requests: [{
        requestId: 'rw',
        timestamp: STAMP,
        response: [{ value: '   ' }],
      }],
    }));

    expect(whitespaceOnly?.entries[0]).toMatchObject({
      kind: 'assistant',
      blocks: [],
    });
  });

  test('extracts file targets, commands, patterns, urls, and todos for each known tool', () => {
    const parsed = parseCopilotHistory(snapshot({
      requests: [{
        requestId: 'rt',
        timestamp: STAMP,
        response: [
          {
            kind: 'toolInvocationSerialized',
            invocationMessage: { value: 'Reading [](file:///repo/spa%20ce/README.md#L12-L20), lines 12 to 20' },
            pastTenseMessage: { value: 'Read [](file:///repo/spa%20ce/README.md#L12-L20)' },
            isComplete: true,
            toolCallId: 't-read',
            toolId: 'copilot_readFile',
          },
          {
            kind: 'toolInvocationSerialized',
            invocationMessage: { value: 'Replacing lines without any markdown link' },
            pastTenseMessage: { value: 'Replaced lines in [](file:///repo/plain2.md)' },
            isComplete: true,
            toolCallId: 't-edit',
            toolId: 'copilot_replaceString',
          },
          {
            kind: 'toolInvocationSerialized',
            invocationMessage: 'Multi-Replace String in Files',
            isComplete: true,
            toolCallId: 't-multi',
            toolId: 'copilot_multiReplaceString',
          },
          {
            kind: 'toolInvocationSerialized',
            invocationMessage: { value: 'Running `pnpm check`' },
            isComplete: true,
            toolCallId: 't-term-original',
            toolId: 'run_in_terminal',
            toolSpecificData: {
              commandLine: {
                original: 'pnpm check',
                toolEdited: 'ignored',
                forDisplay: 'also-ignored',
              },
            },
          },
          {
            kind: 'toolInvocationSerialized',
            invocationMessage: { value: 'Running the fixer' },
            isComplete: true,
            toolCallId: 't-term-edited',
            toolId: 'run_in_terminal',
            toolSpecificData: { commandLine: { forDisplay: 'pnpm fix --cached' } },
          },
          {
            kind: 'toolInvocationSerialized',
            invocationMessage: { value: 'Running something' },
            isComplete: true,
            toolCallId: 't-term-none',
            toolId: 'run_in_terminal',
          },
          {
            kind: 'toolInvocationSerialized',
            invocationMessage: { value: 'Searching for text `Licence` (`**/*.md`)' },
            pastTenseMessage: { value: 'Searched for text `Licence`, 2 results' },
            isComplete: true,
            toolCallId: 't-grep-paren',
            toolId: 'copilot_findTextInFiles',
          },
          {
            kind: 'toolInvocationSerialized',
            invocationMessage: { value: 'Searching for files matching `linteljs` · `packages/**/*.md`' },
            isComplete: true,
            toolCallId: 't-glob',
            toolId: 'copilot_findFiles',
          },
          {
            kind: 'toolInvocationSerialized',
            invocationMessage: { value: 'Searching for regex `npm 11`' },
            pastTenseMessage: { value: 'Searched regex `npm 11` (`src/**`)' },
            isComplete: true,
            toolCallId: 't-grep-backtick',
            toolId: 'copilot_findTextInFiles',
          },
          {
            kind: 'toolInvocationSerialized',
            invocationMessage: { value: 'Searching for text `solo`' },
            isComplete: true,
            toolCallId: 't-grep-bare',
            toolId: 'copilot_findTextInFiles',
          },
          {
            kind: 'toolInvocationSerialized',
            invocationMessage: { value: 'Fetching https://example.com/docs.) now' },
            isComplete: true,
            toolCallId: 't-fetch-url',
            toolId: 'copilot_fetchWebPage',
          },
          {
            kind: 'toolInvocationSerialized',
            isComplete: true,
            toolCallId: 't-fetch-ext',
            toolId: 'vscode_fetchWebPage_internal',
            resultDetails: [{
              external: 'https://ext.example/page',
              path: '/ignored/path',
            }],
          },
          {
            kind: 'toolInvocationSerialized',
            pastTenseMessage: { value: 'Fetched the issue page' },
            isComplete: true,
            toolCallId: 't-fetch-path',
            toolId: 'vscode_fetchWebPage_internal',
            resultDetails: [{ path: '/expo/expo/issues/48091' }],
          },
          {
            kind: 'toolInvocationSerialized',
            isComplete: true,
            toolCallId: 't-fetch-empty',
            toolId: 'copilot_fetchWebPage',
          },
          {
            kind: 'toolInvocationSerialized',
            invocationMessage: { value: 'Created todos' },
            isComplete: true,
            toolCallId: 't-todo',
            toolId: 'manage_todo_list',
            toolSpecificData: {
              todoList: [
                {
                  id: '1',
                  status: 'completed',
                  title: 'Write tests',
                },
                { title: 'Pending task' },
                { id: '3' },
                {},
              ],
            },
          },
          {
            kind: 'toolInvocationSerialized',
            invocationMessage: { value: 'Preparing something' },
            pastTenseMessage: { value: 'Finished copilot_specialThing' },
            isComplete: true,
            toolCallId: 't-unknown',
            toolId: 'copilot_special_thing',
          },
          {
            kind: 'toolInvocationSerialized',
            isComplete: true,
          },
          {
            kind: 'toolInvocationSerialized',
            isComplete: false,
            invocationMessage: { value: 7 },
            pastTenseMessage: { value: 'Broken link fallback [](broken-%zz' },
          },
        ],
      }],
    }));

    const assistant = parsed?.entries.find((entry) => {
      return entry.kind === 'assistant';
    });
    const calls = assistant?.kind === 'assistant'
      ? assistant.blocks.flatMap((block) => {
          return block.blockType === 'tool-use' ? [block.call] : [];
        })
      : [];

    expect(calls).toHaveLength(18);
    expect(calls).toMatchObject([
      {
        name: 'Read',
        input: {
          kind: 'file-read',
          path: '/repo/spa ce/README.md',
        },
      },
      {
        name: 'Edit',
        input: {
          kind: 'file-edit',
          path: '/repo/plain2.md',
        },
      },
      {
        name: 'MultiEdit',
        input: {
          kind: 'multi-edit',
          edits: [],
          path: '',
        },
      },
      {
        name: 'Bash',
        input: {
          kind: 'bash',
          command: 'pnpm check',
        },
      },
      {
        name: 'Bash',
        input: {
          kind: 'bash',
          command: 'pnpm fix --cached',
        },
      },
      {
        name: 'Bash',
        input: {
          kind: 'bash',
          command: '',
        },
      },
      {
        name: 'Grep',
        input: {
          kind: 'search-files',
          pattern: 'Licence',
          searchPath: '**/*.md',
          tool: 'grep',
        },
      },
      {
        name: 'Glob',
        input: {
          kind: 'search-files',
          pattern: 'linteljs',
          searchPath: 'packages/**/*.md',
          tool: 'glob',
        },
      },
      {
        name: 'Grep',
        input: {
          kind: 'search-files',
          pattern: 'npm 11',
          searchPath: 'src/**',
        },
      },
      {
        name: 'Grep',
        input: {
          kind: 'search-files',
          pattern: 'solo',
        },
      },
      {
        name: 'WebFetch',
        input: {
          kind: 'web-fetch',
          url: 'https://example.com/docs',
        },
      },
      {
        name: 'WebFetch',
        input: {
          kind: 'web-fetch',
          url: 'https://ext.example/page',
        },
      },
      {
        name: 'WebFetch',
        input: {
          kind: 'web-fetch',
          url: '/expo/expo/issues/48091',
        },
      },
      {
        name: 'WebFetch',
        input: {
          kind: 'web-fetch',
          url: '',
        },
      },
      {
        name: 'TodoWrite',
        input: {
          kind: 'todo-write',
          todos: [
            {
              content: 'Write tests',
              status: 'completed',
            },
            {
              content: 'Pending task',
              status: 'pending',
            },
            {
              content: '3',
              status: 'pending',
            },
          ],
        },
      },
      {
        name: 'Special thing',
        input: {
          kind: 'generic',
          rows: [{
            label: 'description',
            value: 'Finished copilot_specialThing',
          }],
        },
      },
      {
        name: 'Tool',
        input: {
          kind: 'generic',
          rows: [],
        },
      },
      {
        name: 'Tool',
        input: {
          kind: 'generic',
          rows: [{
            label: 'description',
            value: 'Broken link fallback [](broken-%zz',
          }],
        },
      },
    ]);

    expect(calls[16]?.id.startsWith('rt-')).toBe(true);
    expect(calls[17]?.id.startsWith('rt-')).toBe(true);
    expect(calls[16]?.id).not.toBe(calls[17]?.id);

    const outcomes = pairToolOutcomes(parsed?.entries ?? []);

    expect(outcomes.size).toBe(18);
    const brokenId = calls[17]?.id ?? '';

    expect(outcomes.get('t-edit')?.filePath).toBe('/repo/plain2.md');
    expect(outcomes.get('t-multi')).toMatchObject({
      status: 'ok',
      text: 'Multi-Replace String in Files',
    });
    expect(outcomes.get('t-multi')?.filePath).toBeUndefined();
    expect(outcomes.get('t-unknown')?.status).toBe('ok');
    expect(outcomes.get(brokenId)).toMatchObject({
      status: 'error',
      text: 'Broken link fallback [](broken-%zz',
    });
    expect(outcomes.get(brokenId)?.filePath).toBeUndefined();
  });

  test('carries models, token usage, credits, durations, titles, previews, and identity', () => {
    const parsed = parseCopilotHistory(journal(
      snapshot({
        customTitle: 'Refine docs wording',
        sessionId: 'sid-9',
        requests: [{
          requestId: 'ra',
          timestamp: STAMP,
          responseTimestamp: STAMP + 40,
          modelId: 'copilot/gpt',
          promptTokens: 111,
          completionTokens: 22,
          copilotCredits: 3.5,
          elapsedMs: 1234,
          message: { text: 'Do the thing\n<environment_context>injected</environment_context>' },
          response: [
            {
              kind: 'thinking',
              value: 'Weighing options',
            },
            {
              kind: 'toolInvocationSerialized',
              invocationMessage: 'noop call',
              isComplete: true,
              toolCallId: 'tx',
              toolId: 'copilot_multiReplaceString',
            },
            { value: 'All finished.' },
          ],
        }, {
          timestamp: STAMP + 90,
          responseTimestamp: STAMP + 95,
          result: { metadata: { resolvedModel: 'kimi-k3' } },
          response: [{ value: 'Another prose answer' }],
        }, {
          timestamp: STAMP + 120,
          promptTokens: 0,
          message: { text: '<environment_context>summary-only</environment_context>' },
          response: [],
        }],
      }),
    ));

    expect(parsed).toMatchObject({
      sessionId: 'sid-9',
      title: 'Refine docs wording',
      preview: 'Do the thing',
      firstTimestampMs: STAMP,
      lastTimestampMs: STAMP + 120,
    });
    expect(parsed?.entries).toHaveLength(6);
    expect(parsed?.entries[0]).toMatchObject({
      kind: 'user',
      meta: false,
      text: 'Do the thing',
      injectedText: '<environment_context>injected</environment_context>',
    });
    expect(parsed?.entries[1]).toMatchObject({
      kind: 'assistant',
      model: 'copilot/gpt',
      usage: {
        inputTokens: 111,
        outputTokens: 22,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      },
      costUsd: 3.5,
      durationMs: 1234,
    });
    expect(parsed?.entries[2]).toMatchObject({
      kind: 'user',
      uuid: 'ra-outcomes',
      meta: true,
    });
    expect(parsed?.entries[3]).toMatchObject({
      kind: 'assistant',
      model: 'kimi-k3',
    });
    expect(parsed?.entries[5]).toMatchObject({
      kind: 'assistant',
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
      blocks: [],
    });
  });

  test('skips pre-snapshot patches, rotates snapshots cleanly, and rejects snapshot-less files', () => {
    const rotated = parseCopilotHistory(journal(
      snapshot({
        customTitle: 'Old title',
        sessionId: 'old-session',
        requests: [{
          requestId: 'gone',
          timestamp: STAMP,
          message: { text: 'Lost question' },
        }],
      }),
      '{ "kind": 0, "v": {',
      snapshot({
        customTitle: 'New title',
        sessionId: 'new-session',
        requests: [{
          requestId: 'kept',
          timestamp: STAMP + 500,
          message: { text: 'Kept question' },
        }],
      }),
      setPatch(['requests', 0, 'completionTokens'], 42),
      setPatch(['requests', 0, 'modelId'], 'copilot/next'),
      setPatch(['requests', 9, 'completionTokens'], 43),
      appendPatch(['requests', 0, 'response'], [{
        kind: 'thinking',
        value: 'Fresh thinking',
      }]),
      appendPatch(['requests', 0, 'response'], [31, { value: 'plain item' }]),
      appendPatch(['requests', 3, 'response'], [{ noop: true }]),
      appendPatch(['requests', 0, 'followups'], []),
      JSON.stringify({
        kind: 2,
        k: ['requests', 0],
        v: [{}],
      }),
      JSON.stringify({
        kind: 1,
        k: ['requests', 0, 'timestamp'],
        v: false,
      }),
      JSON.stringify({
        kind: 1,
        k: ['requests', 0, 'message'],
        v: { text: 'Replaced question' },
      }),
    ));

    expect(rotated).toMatchObject({
      sessionId: 'new-session',
      title: 'New title',
      firstTimestampMs: STAMP + 500,
      lastTimestampMs: STAMP + 500,
    });
    expect(rotated?.entries.map((entry) => {
      return entry.kind === 'user' ? entry.text : entry.kind;
    })).toEqual([
      'Replaced question',
      'assistant',
    ]);
    expect(rotated?.entries[1]).toMatchObject({
      kind: 'assistant',
      usage: { outputTokens: 42 },
      model: 'copilot/next',
      blocks: [
        {
          blockType: 'thinking',
          thinking: 'Fresh thinking',
        },
        {
          blockType: 'text',
          text: 'plain item',
        },
      ],
    });

    expect(parseCopilotHistory(setPatch(['requests'], []))).toBeUndefined();
    expect(parseCopilotHistory('')).toBeUndefined();
    expect(parseCopilotHistory(JSON.stringify({
      kind: 0,
      v: 'bare-string',
    }))).toBeUndefined();
    expect(parseCopilotHistory(JSON.stringify({
      kind: 0,
      v: null,
    }))).toBeUndefined();

    const bare = parseCopilotHistory(journal(
      snapshot({}),
      appendPatch(['requests'], [{
        requestId: 'rb',
        timestamp: STAMP,
        message: { text: 'Late arrival' },
      }]),
    ));

    expect(bare).toMatchObject({
      sessionId: '',
      title: undefined,
      preview: 'Late arrival',
      firstTimestampMs: STAMP,
      lastTimestampMs: STAMP,
    });
    expect(bare?.entries).toHaveLength(2);
  });
});

describe('Copilot history discovery', () => {
  test('discovers chat session journals grouped by their VS Code workspace folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'copilot-scan-'));
    const hash = join(root, 'hash-one');
    const sessionsDir = join(hash, 'chatSessions');

    await mkdir(sessionsDir, { recursive: true });
    await mkdir(join(root, 'stray'), { recursive: true });
    await writeFile(join(hash, 'workspace.json'), JSON.stringify({ folder: 'file:///Users/dev/my-app' }));
    await writeFile(join(sessionsDir, 'b.jsonl'), journal(
      snapshot({
        customTitle: 'Later chat',
        sessionId: 'sb',
        requests: [{
          requestId: 'rb',
          timestamp: STAMP + 2000,
          responseTimestamp: STAMP + 3000,
          promptTokens: 10,
          completionTokens: 5,
          message: { text: 'Second prompt' },
          response: [{ value: 'Answer two' }],
        }],
      }),
    ));
    await writeFile(join(sessionsDir, 'a.jsonl'), journal(
      snapshot({
        requests: [{
          requestId: 'ra',
          timestamp: STAMP,
          message: { text: 'First prompt' },
          response: [{
            kind: 'toolInvocationSerialized',
            invocationMessage: 'read it',
            isComplete: true,
            toolCallId: 'ta',
            toolId: 'copilot_readFile',
          }],
        }],
      }),
    ));
    await writeFile(join(sessionsDir, 'broken.jsonl'), '{trunc');
    await writeFile(join(sessionsDir, 'empty.jsonl'), snapshot({}));
    await writeFile(join(sessionsDir, 'notes.txt'), 'not a chat');
    await writeFile(join(root, 'stray', 'outside.jsonl'), snapshot({
      requests: [{
        requestId: 'rx',
        timestamp: STAMP,
        message: { text: 'Outside' },
      }],
    }));

    const sessions = await listCopilotSessions('copilot', [root]);
    const projects = await listCopilotProjects('copilot', [root]);

    expect(sessions).toHaveLength(2);
    expect(new Set(sessions.map((session) => {
      return session.actualSessionId;
    }))).toEqual(new Set(['sb', 'a']));
    expect(sessions.every((session) => {
      return session.projectId === '/Users/dev/my-app'
        && session.cwd === '/Users/dev/my-app';
    })).toBe(true);
    expect(projects).toEqual([expect.objectContaining({
      agent: 'copilot',
      id: '/Users/dev/my-app',
      name: 'my-app',
      actualPath: '/Users/dev/my-app',
      sessionCount: 2,
      messageCount: 3,
    })]);

    const projectSessions = await listCopilotSessions('copilot', [root], '/Users/dev/my-app');

    expect(projectSessions).toHaveLength(2);
    expect(await listCopilotSessions('copilot', [root], '/elsewhere')).toEqual([]);

    const loaded = await loadCopilotEntries(
      sessions.find((session) => {
        return session.actualSessionId === 'sb';
      })?.filePath ?? '',
    );

    expect(loaded).toHaveLength(2);
    expect(await loadCopilotEntries(join(sessionsDir, 'broken.jsonl'))).toBeUndefined();
  });

  test('falls back to unknown projects when workspace records are unusable or absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'copilot-fallback-'));
    const junkHash = join(root, 'junky');
    const brokenUrlHash = join(root, 'badurl');
    const deepSessions = join(root, 'levelA', 'chatSessions');

    await mkdir(join(junkHash, 'chatSessions'), { recursive: true });
    await mkdir(join(brokenUrlHash, 'chatSessions'), { recursive: true });
    await mkdir(deepSessions, { recursive: true });
    await writeFile(join(junkHash, 'workspace.json'), JSON.stringify({ folder: 42 }));
    await writeFile(join(brokenUrlHash, 'workspace.json'), JSON.stringify({ folder: 'not-a-file-url' }));
    await writeFile(join(junkHash, 'chatSessions', 'one.jsonl'), journal(
      snapshot({
        requests: [{
          requestId: 'r1',
          timestamp: STAMP,
          message: { text: 'Prompt one' },
          response: [{ value: 'Done one' }],
        }],
      }),
    ));
    await writeFile(join(brokenUrlHash, 'chatSessions', 'two.jsonl'), journal(
      snapshot({
        requests: [{
          requestId: 'r2',
          timestamp: STAMP + 10,
          message: { text: 'Prompt two' },
          response: [{ value: 'Done two' }],
        }],
      }),
    ));
    await writeFile(join(deepSessions, 'three.jsonl'), journal(
      snapshot({
        sessionId: 'deep-session',
        requests: [{
          requestId: 'r3',
          timestamp: STAMP + 20,
          message: { text: 'Prompt three' },
          response: [{ value: 'Done three' }],
        }],
      }),
    ));

    const projects = await listCopilotProjects('copilot', [root]);

    expect(projects).toEqual([expect.objectContaining({
      id: 'unknown',
      name: 'Unknown project',
      actualPath: undefined,
      sessionCount: 3,
      messageCount: 6,
    })]);

    const sessions = await listCopilotSessions('copilot', [root]);

    expect(sessions).toHaveLength(3);
    expect(sessions.every((session) => {
      return session.projectId === 'unknown' && session.cwd == null;
    })).toBe(true);
    expect(await loadCopilotEntries('/nope/nothing.jsonl')).toBeUndefined();
    expect(await listCopilotProjects('copilot', [join(root, 'missing-root')])).toEqual([]);
  });
});

describe('copilot defensive paths', () => {
  test('ignores journal fields whose values carry the wrong type', () => {
    const parsed = parseCopilotHistory(journal(
      snapshot({
        sessionId: 'defensive',
        requests: [{
          requestId: 'r0',
          timestamp: STAMP,
          modelId: 'kept-model',
          message: { text: 'Kept prompt' },
          response: [],
        }],
      }),
      setPatch(['requests', 0, 'elapsedMs'], 'soon'),
      setPatch(['requests', 0, 'promptTokens'], 'many'),
      setPatch(['requests', 0, 'responseTimestamp'], 'later'),
      setPatch(['requests', 0, 'modelId'], 42),
      setPatch(['requests', 0, 'requestId'], 42),
      setPatch(['requests', 0, 'message'], { text: 42 }),
      setPatch(['requests', 0, 'result'], { metadata: {} }),
      setPatch(['requests', 0, 'response'], { notAnArray: true }),
    ));

    expect(parsed?.entries[0]).toMatchObject({
      kind: 'user',
      uuid: 'r0',
      text: 'Kept prompt',
    });
    expect(parsed?.entries[1]).toMatchObject({
      kind: 'assistant',
      model: 'kept-model',
    });
    expect(parsed?.entries[1]?.kind === 'assistant' ? parsed.entries[1].durationMs : 0)
      .toBeUndefined();
  });

  test('skips non-object records in snapshots and append patches', () => {
    const parsed = parseCopilotHistory(journal(
      JSON.stringify({
        kind: 0,
        v: {
          sessionId: 'mixed',
          requests: ['scalar', null, 7],
        },
      }),
      JSON.stringify({
        kind: 2,
        k: ['requests'],
        v: ['scalar', null, {
          timestamp: STAMP,
          message: { text: 'Real one' },
        }],
      }),
      JSON.stringify({
        kind: 2,
        k: ['requests', 0, 'response'],
      }),
      JSON.stringify({
        kind: 2,
        k: ['requests', 77, 'response'],
        v: [{ value: 'ghost' }],
      }),
    ));

    expect(parsed?.entries[0]).toMatchObject({
      kind: 'user',
      uuid: 'request-0',
      text: 'Real one',
    });
  });

  test('falls back when link targets and tool ids cannot be decoded', () => {
    const parsed = parseCopilotHistory(snapshot({
      sessionId: 'links',
      requests: [{
        requestId: 'r0',
        timestamp: STAMP,
        message: { text: 'Go' },
        response: [
          {
            kind: 'toolInvocationSerialized',
            toolCallId: 'tc-bad-escape',
            toolId: 'copilot_readFile',
            isComplete: true,
            invocationMessage: { value: 'Reading [](file:///repo/%E0%A4%A.md)' },
          },
          {
            kind: 'toolInvocationSerialized',
            toolCallId: 'tc-relative',
            toolId: 'copilot_readFile',
            isComplete: true,
            invocationMessage: { value: 'Reading [](notes/plain.md)' },
          },
          {
            kind: 'toolInvocationSerialized',
            toolCallId: 'tc-nameless',
            toolId: 'copilot_',
            isComplete: true,
            invocationMessage: { value: 'Doing something' },
          },
        ],
      }],
    }));

    const blocks = parsed?.entries[1]?.kind === 'assistant' ? parsed.entries[1].blocks : [];
    const names = blocks.flatMap((block) => {
      return block.blockType === 'tool-use' ? [block.call.name] : [];
    });

    expect(names).toContain('Tool');
    expect(names).toHaveLength(3);
  });

  test('reads search tool arguments with and without an include filter', () => {
    const parsed = parseCopilotHistory(snapshot({
      sessionId: 'search',
      requests: [{
        requestId: 'r0',
        timestamp: STAMP,
        message: { text: 'Find' },
        response: [
          {
            kind: 'toolInvocationSerialized',
            toolCallId: 'tc-text-bare',
            toolId: 'copilot_findTextInFiles',
            isComplete: true,
            invocationMessage: { value: 'Searching for `needle`' },
          },
          {
            kind: 'toolInvocationSerialized',
            toolCallId: 'tc-files-bare',
            toolId: 'copilot_findFiles',
            isComplete: true,
            invocationMessage: { value: 'Searching for `*.ts`' },
          },
          {
            kind: 'toolInvocationSerialized',
            toolCallId: 'tc-files-scoped',
            toolId: 'copilot_findFiles',
            isComplete: true,
            invocationMessage: { value: 'Searching for `*.ts` in `src`' },
          },
        ],
      }],
    }));

    const blocks = parsed?.entries[1]?.kind === 'assistant' ? parsed.entries[1].blocks : [];
    const inputs = blocks.flatMap((block) => {
      return block.blockType === 'tool-use' ? [block.call.input] : [];
    });

    expect(inputs).toHaveLength(3);
    expect(inputs.some((input) => {
      return input.kind === 'search-files' && input.searchPath == null;
    })).toBe(true);
    expect(inputs.some((input) => {
      return input.kind === 'search-files' && input.searchPath === 'src';
    })).toBe(true);
  });

  test('ignores a workspace record without a usable folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'copilot-folderless-'));
    const workspace = join(root, 'hash-1');

    await mkdir(join(workspace, 'chatSessions'), { recursive: true });
    await writeFile(join(workspace, 'workspace.json'), JSON.stringify({ folder: 7 }), 'utf8');
    await writeFile(
      join(workspace, 'chatSessions', 'a.jsonl'),
      snapshot({
        sessionId: 'folderless',
        requests: [{
          requestId: 'r0',
          timestamp: STAMP,
          message: { text: 'Prompt' },
          response: [{ value: 'Reply' }],
        }],
      }),
      'utf8',
    );

    const sessions = await listCopilotSessions('copilot', [root]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.cwd).toBeUndefined();
  });
});

describe('copilot remaining edge paths', () => {
  test('drops empty link targets and indexes that are not turn positions', () => {
    const parsed = parseCopilotHistory(journal(
      JSON.stringify({
        kind: 0,
        v: {
          sessionId: 'edges',
          requests: [{
            timestamp: STAMP,
            message: { text: 'Go' },
            response: 'not-an-array',
          }],
        },
      }),
      JSON.stringify({
        kind: 2,
        k: ['requests', 'x', 'response'],
        v: [{ value: 'ghost' }],
      }),
      appendPatch(['requests', 0, 'response'], [{
        kind: 'toolInvocationSerialized',
        toolCallId: 'tc-empty-link',
        toolId: 'copilot_readFile',
        isComplete: true,
        invocationMessage: { value: 'Reading []()' },
      }]),
    ));

    expect(parsed?.entries[0]).toMatchObject({
      kind: 'user',
      uuid: 'request-0',
    });

    const blocks = parsed?.entries[1]?.kind === 'assistant' ? parsed.entries[1].blocks : [];

    expect(blocks).toHaveLength(1);
  });

  test('takes search filters from the past tense message when the invocation lacks them', () => {
    const parsed = parseCopilotHistory(snapshot({
      sessionId: 'filters',
      requests: [{
        requestId: 'r0',
        timestamp: STAMP,
        message: { text: 'Find' },
        response: [
          {
            kind: 'toolInvocationSerialized',
            toolCallId: 'tc-text-scoped',
            toolId: 'copilot_findTextInFiles',
            isComplete: true,
            invocationMessage: { value: 'Searching the workspace' },
            pastTenseMessage: { value: 'Searched for `needle` in `src`' },
          },
          {
            kind: 'toolInvocationSerialized',
            toolCallId: 'tc-text-inline',
            toolId: 'copilot_findTextInFiles',
            isComplete: true,
            invocationMessage: { value: 'Searching for `needle` in `lib`' },
          },
          {
            kind: 'toolInvocationSerialized',
            toolCallId: 'tc-files-scoped2',
            toolId: 'copilot_findFiles',
            isComplete: true,
            invocationMessage: { value: 'Searching for `*.md` in `docs`' },
          },
        ],
      }],
    }));

    const blocks = parsed?.entries[1]?.kind === 'assistant' ? parsed.entries[1].blocks : [];
    const paths = blocks.flatMap((block) => {
      return block.blockType === 'tool-use' && block.call.input.kind === 'search-files'
        ? [block.call.input.searchPath]
        : [];
    });

    expect(paths).toContain('src');
    expect(paths).toContain('lib');
    expect(paths).toContain('docs');
  });

  test('skips unreadable session files and orders projects by last activity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'copilot-projects-'));

    for (const [index, name] of ['alpha', 'beta'].entries()) {
      const workspace = join(root, `hash-${name}`);

      await mkdir(join(workspace, 'chatSessions'), { recursive: true });
      await writeFile(
        join(workspace, 'workspace.json'),
        JSON.stringify({ folder: `file:///repo/${name}` }),
        'utf8',
      );
      await writeFile(
        join(workspace, 'chatSessions', 'session.jsonl'),
        snapshot({
          sessionId: `session-${name}`,
          requests: [{
            requestId: 'r0',
            timestamp: STAMP + index * 1000,
            message: { text: 'Prompt' },
            response: [{ value: 'Reply' }],
          }],
        }),
        'utf8',
      );
    }

    // A directory where a session file is expected makes readFile fail.
    await mkdir(join(root, 'hash-alpha', 'chatSessions', 'broken.jsonl'), { recursive: true });

    const projects = await listCopilotProjects('copilot', [root]);

    expect(projects).toHaveLength(2);
    expect(projects[0]?.name).toBe('beta');
    expect(projects[1]?.name).toBe('alpha');
  });
});

describe('copilot last edge paths', () => {
  test('handles anchor only links, bare search phrases and missing turn stamps', () => {
    const parsed = parseCopilotHistory(JSON.stringify({
      kind: 0,
      v: {
        sessionId: 'last-edges',
        requests: [{
          requestId: 'r0',
          message: { text: 'Go' },
          response: [
            'scalar-item',
            null,
            {
              kind: 'toolInvocationSerialized',
              toolCallId: 'tc-anchor',
              toolId: 'copilot_readFile',
              isComplete: true,
              invocationMessage: { value: 'Reading [](#section-only)' },
            },
            {
              kind: 'toolInvocationSerialized',
              toolCallId: 'tc-text-bare2',
              toolId: 'copilot_findTextInFiles',
              isComplete: true,
              invocationMessage: { value: 'Searching the workspace' },
            },
            {
              kind: 'toolInvocationSerialized',
              toolCallId: 'tc-files-bare2',
              toolId: 'copilot_findFiles',
              isComplete: true,
              invocationMessage: { value: 'Searching for files' },
            },
          ],
        }],
      },
    }));

    expect(parsed?.entries[0]).toMatchObject({
      kind: 'user',
      uuid: 'r0',
      timestamp: new Date(0).toISOString(),
    });

    const blocks = parsed?.entries[1]?.kind === 'assistant' ? parsed.entries[1].blocks : [];
    const patterns = blocks.flatMap((block) => {
      return block.blockType === 'tool-use' && block.call.input.kind === 'search-files'
        ? [block.call.input.pattern]
        : [];
    });

    expect(blocks).toHaveLength(3);
    expect(patterns).toEqual(['', '']);
  });

  test('ignores workspace records that are not objects and sessions that cannot be read', async () => {
    const root = await mkdtemp(join(tmpdir(), 'copilot-unreadable-'));
    const workspace = join(root, 'hash-1');
    const sessions = join(workspace, 'chatSessions');

    await mkdir(sessions, { recursive: true });
    await writeFile(join(workspace, 'workspace.json'), '["not-an-object"]', 'utf8');
    await writeFile(
      join(sessions, 'good.jsonl'),
      snapshot({
        sessionId: 'good',
        requests: [{
          requestId: 'r0',
          timestamp: STAMP,
          message: { text: 'Prompt' },
          response: [{ value: 'Reply' }],
        }],
      }),
      'utf8',
    );

    const locked = join(sessions, 'locked.jsonl');

    await writeFile(locked, 'irrelevant', 'utf8');
    await chmod(locked, 0o000);

    const found = await listCopilotSessions('copilot', [root]);

    await chmod(locked, 0o644);

    expect(found).toHaveLength(1);
    expect(found[0]?.cwd).toBeUndefined();
  });
});
