import {
  describe,
  expect,
  test,
} from 'vitest';

import { parseHistoryLine } from './parserUtils';

import type { ToolCallInput } from '../../history/types';
import type { RawHistoryLine, RawToolInput } from '../../history/utils/claudeRawUtils';

const line = (fields: RawHistoryLine): string => {
  return JSON.stringify(fields);
};

const parseFields = (fields: RawHistoryLine) => {
  return parseHistoryLine(line(fields));
};

describe('parseHistoryLine', () => {
  test('returns undefined for blank, malformed, non-object and unrendered lines', () => {
    expect(parseHistoryLine('')).toBeUndefined();
    expect(parseHistoryLine('{not json')).toBeUndefined();
    expect(parseHistoryLine('42')).toBeUndefined();
    expect(
      parseFields({
        type: 'file-history-snapshot',
        uuid: 'u1',
        timestamp: 't1',
      }),
    ).toBeUndefined();
    expect(parseFields({ type: 'summary' })).toBeUndefined();
  });

  test('parses a plain user turn', () => {
    const entry = parseFields({
      type: 'user',
      uuid: 'u1',
      timestamp: '2026-01-01T00:00:00Z',
      isSidechain: true,
      message: {
        role: 'user',
        content: 'hello there',
      },
    });

    expect(entry).toEqual({
      kind: 'user',
      uuid: 'u1',
      timestamp: '2026-01-01T00:00:00Z',
      sidechain: true,
      meta: false,
      text: 'hello there',
      command: undefined,
      outcomes: [],
    });
  });

  test('extracts a slash command label and drops the tagged text', () => {
    const entry = parseFields({
      type: 'user',
      uuid: 'u1',
      timestamp: 't1',
      message: {
        role: 'user',
        content: [
          '<command-name>/rename</command-name>',
          '<command-message>rename</command-message>',
          '<command-args>new name</command-args>',
        ].join('\n'),
      },
    });

    expect(entry).toMatchObject({
      kind: 'user',
      text: '',
      command: '/rename new name',
    });
  });

  test('marks local command echoes as meta even without the flag', () => {
    const entry = parseFields({
      type: 'user',
      uuid: 'u1',
      timestamp: 't1',
      message: {
        role: 'user',
        content: '<local-command-stdout>done</local-command-stdout>',
      },
    });

    expect(entry).toMatchObject({ meta: true });
  });

  test('separates injected context appended to a real user message', () => {
    const entry = parseFields({
      type: 'user',
      uuid: 'u1',
      timestamp: 't1',
      message: {
        role: 'user',
        content: [
          'Fix all of these.',
          '<recommended_plugins>',
          'plugin catalog',
          '</recommended_plugins>',
          '<environment_context>',
          'workspace details',
          '</environment_context>',
        ].join('\n'),
      },
    });

    expect(entry).toMatchObject({
      kind: 'user',
      meta: false,
      text: 'Fix all of these.',
      injectedText: [
        '<recommended_plugins>',
        'plugin catalog',
        '</recommended_plugins>',
        '<environment_context>',
        'workspace details',
        '</environment_context>',
      ].join('\n'),
    });
  });

  test('falls back to empty identity fields when absent', () => {
    const entry = parseFields({
      type: 'user',
      isMeta: true,
      message: {
        role: 'user',
        content: 'no ids here',
      },
    });

    expect(entry).toMatchObject({
      uuid: '',
      timestamp: '',
      meta: true,
    });
  });

  test('returns undefined for user lines without a payload', () => {
    expect(parseFields({
      type: 'user',
      uuid: 'u1',
      timestamp: 't1',
    })).toBeUndefined();
  });

  test('collects text parts across user content blocks', () => {
    const entry = parseFields({
      type: 'user',
      uuid: 'u1',
      timestamp: 't1',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'first part',
          },
          {
            type: 'text',
            text: 'second part',
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: 'aaa',
            },
          },
        ],
      },
    });

    expect(entry).toMatchObject({
      kind: 'user',
      text: 'first part\n\nsecond part',
    });
  });

  test('parses a failed tool result with string content', () => {
    const entry = parseFields({
      type: 'user',
      uuid: 'u1',
      timestamp: 't1',
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'tu1',
          content: 'boom',
          is_error: true,
        }],
      },
    });

    expect(entry).toMatchObject({
      kind: 'user',
      outcomes: [{
        toolUseId: 'tu1',
        status: 'error',
        text: 'boom',
      }],
    });
  });

  test('enriches an outcome with the structured side channel', () => {
    const entry = parseFields({
      type: 'user',
      uuid: 'u1',
      timestamp: 't1',
      toolUseResult: {
        filePath: '/srv/private/a.ts',
        stdout: 'out',
        stderr: 'err',
        interrupted: true,
        structuredPatch: [
          {
            oldStart: 1,
            oldLines: 2,
            newStart: 1,
            newLines: 3,
            lines: ['-a', '+b'],
          },
          {
            oldStart: 9,
            oldLines: 0,
            newStart: 9,
            newLines: 0,
          },
        ],
      },
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'tu1',
          content: '',
        }],
      },
    });

    expect(entry).toMatchObject({
      outcomes: [
        {
          toolUseId: 'tu1',
          status: 'interrupted',
          filePath: '/srv/private/a.ts',
          stdout: 'out',
          stderr: 'err',
          patch: [{
            oldStart: 1,
            oldLines: 2,
            newStart: 1,
            newLines: 3,
            lines: ['-a', '+b'],
          }],
        },
      ],
    });
  });

  test('keeps image parts and skips sources without a media type', () => {
    const entry = parseFields({
      type: 'user',
      uuid: 'u1',
      timestamp: 't1',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tu1',
            content: [
              {
                type: 'image',
                source: {
                  media_type: 'image/jpeg',
                  data: 'zzz',
                },
              },
              { type: 'tool_reference' },
            ],
          },
        ],
      },
    });

    expect(entry).toMatchObject({
      outcomes: [{
        toolUseId: 'tu1',
        images: [{
          mediaType: 'image/jpeg',
          data: 'zzz',
          url: undefined,
        }],
      }],
    });
  });

  test('ignores the side channel when several results share one line', () => {
    const entry = parseFields({
      type: 'user',
      uuid: 'u1',
      timestamp: 't1',
      toolUseResult: {
        filePath: '/srv/private/a.ts',
        interrupted: true,
      },
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tu1',
            content: 'one',
          },
          {
            type: 'tool_result',
            tool_use_id: 'tu2',
            content: 'two',
          },
        ],
      },
    });

    expect(entry).toMatchObject({
      outcomes: [
        {
          toolUseId: 'tu1',
          status: 'ok',
          filePath: undefined,
        },
        {
          toolUseId: 'tu2',
          status: 'ok',
        },
      ],
    });
  });
});

describe('assistant turns', () => {
  test('maps usage metrics and cost fields', () => {
    const entry = parseFields({
      type: 'assistant',
      uuid: 'a1',
      timestamp: 't1',
      costUSD: 0.5,
      durationMs: 1200,
      message: {
        role: 'assistant',
        model: 'claude-sonnet-5',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_creation_input_tokens: 5,
          cache_read_input_tokens: 7,
        },
        content: [{
          type: 'text',
          text: 'answer',
        }],
      },
    });

    expect(entry).toEqual({
      kind: 'assistant',
      uuid: 'a1',
      timestamp: 't1',
      sidechain: false,
      model: 'claude-sonnet-5',
      stopReason: 'end_turn',
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        cacheCreationTokens: 5,
        cacheReadTokens: 7,
      },
      costUsd: 0.5,
      durationMs: 1200,
      blocks: [{
        blockType: 'text',
        text: 'answer',
      }],
    });
  });

  test('drops blank text and thinking blocks but keeps redacted ones', () => {
    const entry = parseFields({
      type: 'assistant',
      uuid: 'a1',
      timestamp: 't1',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '',
          },
          {
            type: 'thinking',
            thinking: '',
          },
          {
            type: 'redacted_thinking',
            data: 'x',
          },
        ],
      },
    });

    expect(entry).toMatchObject({ blocks: [{ blockType: 'redacted' }] });
  });

  test('returns undefined without a payload and skips unknown tool calls', () => {
    expect(parseFields({
      type: 'assistant',
      uuid: 'a1',
      timestamp: 't1',
    })).toBeUndefined();

    const entry = parseFields({
      type: 'assistant',
      uuid: 'a1',
      timestamp: 't1',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          name: 'Bash',
        }],
      },
    });

    expect(entry).toMatchObject({ blocks: [] });
  });
});

describe('system and summary lines', () => {
  test('prefers string content for system text and falls back to subtype', () => {
    const withContent = parseFields({
      type: 'system',
      uuid: 's1',
      timestamp: 't1',
      subtype: 'stop_hook_summary',
      level: 'info',
      content: 'hooks finished',
    });

    expect(withContent).toEqual({
      kind: 'system',
      uuid: 's1',
      timestamp: 't1',
      sidechain: false,
      level: 'info',
      subtype: 'stop_hook_summary',
      text: 'hooks finished',
    });

    const withoutContent = parseFields({
      type: 'system',
      uuid: 's2',
      timestamp: 't2',
      subtype: 'compact',
    });

    expect(withoutContent).toMatchObject({
      text: 'compact',
      level: undefined,
    });
  });

  test('labels a system line without subtype or level', () => {
    const entry = parseFields({
      type: 'system',
      uuid: 's3',
      timestamp: 't3',
      isSidechain: true,
    });

    expect(entry).toMatchObject({
      text: 'system event',
      subtype: undefined,
      sidechain: true,
    });
  });

  test('parses a summary line and drops empty summaries', () => {
    expect(parseFields({
      type: 'summary',
      summary: 'A chat about diffs',
    })).toEqual({
      kind: 'summary',
      text: 'A chat about diffs',
    });
    expect(parseFields({
      type: 'summary',
      summary: '',
    })).toBeUndefined();
  });
});

describe('todo and task parsing through full lines', () => {
  test('maps TodoWrite todos and drops empty entries', () => {
    const entry = parseFields({
      type: 'assistant',
      uuid: 'a1',
      timestamp: 't1',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tu1',
            name: 'TodoWrite',
            input: {
              todos: [
                {
                  content: 'ship it',
                  status: 'in_progress',
                  activeForm: 'shipping',
                },
                {
                  content: '',
                  status: 'pending',
                },
              ],
            },
          },
        ],
      },
    });

    const block = entry?.kind === 'assistant' ? entry.blocks[0] : undefined;

    expect(block).toMatchObject({
      blockType: 'tool-use',
      call: {
        id: 'tu1',
        name: 'TodoWrite',
        input: {
          kind: 'todo-write',
          todos: [{
            content: 'ship it',
            status: 'in_progress',
            activeForm: 'shipping',
          }],
        },
      },
    });
  });

  test('builds generic rows from recognised scalar fields plus numeric paging', () => {
    const entry = parseFields({
      type: 'assistant',
      uuid: 'a1',
      timestamp: 't1',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tu1',
            name: 'NotebookEdit',
            input: {
              file_path: '/n.ipynb',
              query: 'cell',
              limit: 5,
              offset: 10,
            },
          },
        ],
      },
    });

    const block = entry?.kind === 'assistant' ? entry.blocks[0] : undefined;

    expect(block).toMatchObject({
      call: {
        input: {
          kind: 'generic',
          title: 'NotebookEdit',
          rows: [
            {
              label: 'file',
              value: '/n.ipynb',
            },
            {
              label: 'query',
              value: 'cell',
            },
            {
              label: 'limit',
              value: '5',
            },
            {
              label: 'offset',
              value: '10',
            },
          ],
        },
      },
    });
  });
});

describe('every dedicated tool input kind through full lines', () => {
  const callInput = (name: string, input: RawToolInput): ToolCallInput | undefined => {
    const entry = parseFields({
      type: 'assistant',
      uuid: 'a1',
      timestamp: 't1',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'tu1',
          name,
          input,
        }],
      },
    });

    if (entry?.kind !== 'assistant') {
      return undefined;
    }

    const block = entry.blocks.at(0);

    return block?.blockType === 'tool-use' ? block.call.input : undefined;
  };

  test('routes each known tool name', () => {
    expect(callInput('Bash', { command: 'ls' })).toMatchObject({ kind: 'bash' });
    expect(callInput('Write', {
      file_path: '/f',
      content: 'x',
    })).toMatchObject({
      kind: 'file-write',
      path: '/f',
    });
    expect(callInput('Edit', {
      file_path: '/f',
      old_string: 'o',
      new_string: 'n',
      replace_all: true,
    })).toEqual({
      kind: 'file-edit',
      path: '/f',
      oldString: 'o',
      newString: 'n',
      replaceAll: true,
    });
    expect(
      callInput('MultiEdit', {
        file_path: '/f',
        edits: [
          {
            old_string: 'a',
            new_string: 'b',
          },
          {
            old_string: '',
            new_string: '',
            replace_all: true,
          },
        ],
      }),
    ).toEqual({
      kind: 'multi-edit',
      path: '/f',
      edits: [
        {
          oldString: 'a',
          newString: 'b',
          replaceAll: false,
        },
        {
          oldString: '',
          newString: '',
          replaceAll: true,
        },
      ],
    });
    expect(callInput('Read', { file_path: '/r' })).toEqual({
      kind: 'file-read',
      path: '/r',
    });
    expect(callInput('Glob', {
      pattern: '*.ts',
      path: '/src',
    })).toEqual({
      kind: 'search-files',
      tool: 'glob',
      pattern: '*.ts',
      searchPath: '/src',
    });
    expect(callInput('Grep', { pattern: 'x' })).toEqual({
      kind: 'search-files',
      tool: 'grep',
      pattern: 'x',
      searchPath: undefined,
    });
    expect(callInput('WebSearch', { query: 'q' })).toEqual({
      kind: 'web-search',
      query: 'q',
    });
    expect(callInput('WebFetch', {
      url: 'https://x',
      prompt: 'sum',
    })).toEqual({
      kind: 'web-fetch',
      url: 'https://x',
      prompt: 'sum',
    });
    expect(callInput('TodoWrite', {})).toEqual({
      kind: 'todo-write',
      todos: [],
    });
    expect(callInput('Task', {
      subagent_type: 'scout',
      description: 'd',
    })).toEqual({
      kind: 'task',
      agentType: 'scout',
      description: 'd',
      prompt: undefined,
    });
  });

  test('generic rows cover every candidate slot and skip empties', () => {
    const filled = callInput('Mystery', {
      file_path: '/p',
      path: '/p2',
      pattern: '*',
      query: 'qq',
      url: 'https://u',
      command: 'c',
      description: 'd',
      prompt: 'pp',
      skill: 'sk',
      limit: 3,
      offset: 4,
    });

    if (filled?.kind !== 'generic') {
      throw new Error('expected a generic call');
    }

    expect(filled.rows.map((row) => {
      return row.label;
    })).toEqual([
      'file',
      'path',
      'pattern',
      'query',
      'url',
      'command',
      'description',
      'prompt',
      'skill',
      'limit',
      'offset',
    ]);

    const empty = callInput('Mystery', {});

    if (empty?.kind !== 'generic') {
      throw new Error('expected a generic call');
    }

    expect(empty.rows).toEqual([]);
  });
});

describe('primitive JSON lines', () => {
  test('rejects arrays and scalars as history lines', () => {
    expect(parseHistoryLine('[1,2]')).toBeUndefined();
    expect(parseHistoryLine('"just text"')).toBeUndefined();
    expect(parseHistoryLine('null')).toBeUndefined();
  });
});

describe('unknown assistant blocks', () => {
  test('skips block types it does not render', () => {
    const entry = parseFields({
      type: 'assistant',
      uuid: 'a9',
      timestamp: 't',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'image',
            source: {
              media_type: 'image/png',
              data: 'z',
            },
          },
          {
            type: 'text',
            text: 'visible',
          },
        ],
      },
    });

    expect(entry?.kind === 'assistant' && entry.blocks.every((b) => {
      return b.blockType !== 'tool-use';
    })).toBe(true);
  });
});

describe('parser fallback arms', () => {
  test('zero-fills partial usage payloads', () => {
    const entry = parseFields({
      type: 'assistant',
      uuid: 'a1',
      timestamp: 't',
      message: {
        role: 'assistant',
        content: [],
        usage: { input_tokens: 5 },
      },
    });

    expect(entry).toMatchObject({
      kind: 'assistant',
      usage: {
        inputTokens: 5,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      },
    });
  });

  test('treats string assistant content as having no blocks', () => {
    const entry = parseFields({
      type: 'assistant',
      uuid: 'a2',
      timestamp: 't',
      message: {
        role: 'assistant',
        content: 'plain text body',
      },
    });

    expect(entry).toMatchObject({
      kind: 'assistant',
      blocks: [],
    });
  });

  test('labels anonymous tool calls and defaults todo statuses', () => {
    const anon = parseFields({
      type: 'assistant',
      uuid: 'a3',
      timestamp: 't',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'x1',
          input: { command: 'ls' },
        }],
      },
    });
    const named = parseFields({
      type: 'assistant',
      uuid: 'a4',
      timestamp:
  't',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'x2',
          name: 'TodoWrite',
          input: {
            todos: [{ content: 'step' }],
          },
        }],
      },
    });

    const anonBlock = anon?.kind === 'assistant' ? anon.blocks.at(0) : undefined;
    const namedBlock = named?.kind === 'assistant' ? named.blocks.at(0) : undefined;

    expect(anonBlock?.blockType === 'tool-use' && anonBlock.call.name).toBe('unknown');
    expect(
      namedBlock?.blockType === 'tool-use' && namedBlock.call.input.kind === 'todo-write'
        ? namedBlock.call.input.todos.at(0)?.status
        : '',
    ).toBe('pending');
  });

  test('defaults edit fields when the input omits them', () => {
    const entry = parseFields({
      type: 'assistant',
      uuid: 'a5',
      timestamp: 't',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'x3',
          name: 'Edit',
          input: {},
        }],
      },
    });
    const block = entry?.kind === 'assistant' ? entry.blocks.at(0) : undefined;

    expect(block?.blockType === 'tool-use' && block.call.input).toEqual({
      kind: 'file-edit',
      path: '',
      oldString: '',
      newString: '',
      replaceAll: false,
    });
  });

  test('ignores a string side channel and lets error beat interrupted', () => {
    const entry = parseFields({
      type: 'user',
      uuid: 'u9',
      timestamp: 't',
      toolUseResult: 'plain string result',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tuE',
            content: [{
              type: 'text',
              text: 'part text',
            }],
            is_error: true,
          },
        ],
      },
    });

    expect(entry?.kind === 'user' && entry.outcomes.at(0)).toMatchObject({
      status: 'error',
      text: 'part text',
      stdout: undefined,
    });
  });
});

describe('absent-field fallbacks across the parser', () => {
  const callInputOf = (name: string): ToolCallInput => {
    const entry = parseFields({
      type: 'assistant',
      uuid: 'a',
      timestamp: 't',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'tu',
          name,
        }],
      },
    });

    if (entry?.kind !== 'assistant') {
      throw new Error('no turn');
    }

    const block = entry.blocks.at(0);

    if (block?.blockType !== 'tool-use') {
      throw new Error('no tool call');
    }

    return block.call.input;
  };

  test('every tool kind tolerates a completely empty input object', () => {
    expect(callInputOf('Bash')).toEqual({
      kind: 'bash',
      command: '',
      description: undefined,
    });
    expect(callInputOf('Write')).toEqual({
      kind: 'file-write',
      path: '',
      content: '',
    });
    expect(callInputOf('Edit')).toEqual({
      kind: 'file-edit',
      path: '',
      oldString: '',
      newString: '',
      replaceAll: false,
    });
    expect(callInputOf('MultiEdit')).toEqual({
      kind: 'multi-edit',
      path: '',
      edits: [],
    });
    expect(callInputOf('Read')).toEqual({
      kind: 'file-read',
      path: '',
    });
    expect(callInputOf('Glob')).toEqual({
      kind: 'search-files',
      tool: 'glob',
      pattern: '',
      searchPath: undefined,
    });
    expect(callInputOf('Grep')).toEqual({
      kind: 'search-files',
      tool: 'grep',
      pattern: '',
      searchPath: undefined,
    });
    expect(callInputOf('WebSearch')).toEqual({
      kind: 'web-search',
      query: '',
    });
    expect(callInputOf('WebFetch')).toEqual({
      kind: 'web-fetch',
      url: '',
      prompt: undefined,
    });
    expect(callInputOf('TodoWrite')).toEqual({
      kind: 'todo-write',
      todos: [],
    });
    expect(callInputOf('Task')).toEqual({
      kind: 'task',
      agentType: undefined,
      description: undefined,
      prompt:
  undefined,
    });
  });

  test('usage falls back field-by-field when only cache reads exist', () => {
    const entry = parseFields({
      type: 'assistant',
      uuid: 'a',
      timestamp: 't',
      message: {
        role: 'assistant',
        usage: { cache_read_input_tokens: 9 },
        content: [],
      },
    });

    expect(entry?.kind === 'assistant' && entry.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 9,
    });
  });

  test('outcome parts survive missing identifiers, text and image payloads', () => {
    const entry = parseFields({
      type: 'user',
      timestamp: 't',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            content: [{ type: 'text' }, { type: 'image' }],
          },
          {
            type: 'tool_result',
            content: [],
          },
        ],
      },
    });

    const outcomes = entry?.kind === 'user' ? entry.outcomes : [];

    expect(outcomes.at(0)?.toolUseId).toBe('');
    expect(outcomes.at(1)?.text).toBeUndefined();
    expect(outcomes.at(1)?.patch).toBeUndefined();
  });

  test('patch hunks fall back to line counts when positions are absent', () => {
    const entry = parseFields({
      type: 'user',
      uuid: 'u',
      timestamp: 't',
      toolUseResult: { structuredPatch: [{ lines: ['-x', '+y'] }] },
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: 'tuP',
          content: '',
        }],
      },
    });

    const outcomes = entry?.kind === 'user' ? entry.outcomes : [];

    expect(outcomes.at(0)?.patch?.at(0)).toEqual({
      oldStart: 0,
      oldLines: 2,
      newStart: 0,
      newLines: 2,
      lines: ['-x', '+y'],
    });
  });

  test('slash commands without args keep just the name', () => {
    const entry = parseFields({
      type:
  'user',
      uuid: 'u',
      timestamp: 't',
      message: {
        role: 'user',
        content:
  '<command-name>/clear</command-name>\n<command-message>clear</command-message>',
      },
    });

    expect(entry?.kind === 'user' && entry.command).toBe('/clear');
  });

  test('text-bearing blocks tolerate missing text keys and identity fields', () => {
    const user = parseFields({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text' }],
      },
    });
    const assistant = parseFields({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text' }, { type: 'thinking' }],
      },
    });
    const system = parseFields({ type: 'system' });

    expect(user?.kind === 'user' && user.text).toBe('');
    expect(assistant?.kind === 'assistant' && assistant.uuid && assistant.timestamp).toBe('');

    if (assistant?.kind !== 'assistant') {
      throw new Error('no turn');
    }

    expect(assistant.blocks).toEqual([]);
    expect(system?.kind === 'system' && system.uuid).toBe('');
  });
});

describe('final parser arms', () => {
  test('handles absent content, todo keys, edit keys and bare tool results', () => {
    const noContent = parseFields({
      type: 'assistant',
      uuid: 'a',
      timestamp: 't',
      message: { role: 'assistant' },
    });

    expect(noContent?.kind === 'assistant'
      && noContent.blocks).toEqual([]);

    const todos = parseFields({
      type: 'assistant',
      uuid: 'b',
      timestamp: 't',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 't',
          name: 'TodoWrite',
          input: { todos: [{}] },
        }],
      },
    });
    const todoBlock = todos?.kind === 'assistant' ? todos.blocks.at(0) : undefined;

    expect(todoBlock?.blockType === 'tool-use' && todoBlock.call.input.kind === 'todo-write'
      ? todoBlock.call.input.todos
      : []).toEqual([]);

    const multiEdit = parseFields({
      type: 'assistant',
      uuid: 'c',
      timestamp: 't',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'm',
          name: 'MultiEdit',
          input: { edits: [{}] },
        }],
      },
    });
    const multiBlock = multiEdit?.kind === 'assistant' ? multiEdit.blocks.at(0) : undefined;

    expect(multiBlock?.blockType === 'tool-use' && multiBlock.call.input.kind === 'multi-edit'
      ? multiBlock.call.input.edits
      : []).toEqual([{
      oldString: '',
      newString: '',
      replaceAll: false,
    }]);

    const bare = parseFields({
      type: 'user',
      uuid: 'u',
      timestamp: 't',
      message: {
        role: 'user',
        content: [{ type: 'tool_result' }],
      },
      toolUseResult: 'string side channel ignored',
    });

    expect(bare?.kind === 'user' && bare.outcomes.at(0)).toMatchObject({
      toolUseId: '',
      status: 'ok',
      text: undefined,
    });

    const leveledSystem = parseFields({
      type: 'system',
      uuid: 's',
      timestamp: 'ts',
      level: 'warn',
      subtype: 'hook',
    });

    expect(leveledSystem?.kind === 'system' && leveledSystem.text).toBe('hook (warn)');
  });
});
