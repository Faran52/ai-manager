import {
  mkdir,
  mkdtemp,
  symlink,
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
  listCodexProjects,
  listCodexSessions,
  loadCodexEntries,
  parseCodexHistory,
} from './codexUtils';

const line = (type: string, payload: object, timestamp = '2026-01-01T00:00:00.000Z'): string => {
  return JSON.stringify({
    type,
    timestamp,
    payload,
  });
};

const history = (id: string, cwd: string): string => {
  return [
    line('session_meta', {
      id,
      cwd,
    }),
    line('turn_context', {
      model: 'gpt-5',
      cwd,
    }),
    line('response_item', {
      type: 'message',
      role: 'user',
      content: [{
        type: 'input_text',
        text: 'Build it',
      }],
    }),
    line('response_item', {
      type: 'message',
      role: 'assistant',
      content: [{
        type: 'output_text',
        text: 'Done',
      }],
    }),
  ].join('\n');
};

describe('parseCodexHistory', () => {
  test('maps messages, tools, outcomes, compaction, and metadata', () => {
    const content = [
      '',
      '{bad',
      line('session_meta', {
        id: 'thread-1',
        cwd: '/repo',
      }, 'bad-date'),
      line('session_meta', {
        id: 'ignored',
        cwd: '/ignored',
      }),
      line('turn_context', {
        model: 'gpt-5',
        cwd: '/fallback',
      }),
      line('turn_context', {}),
      line('compacted', {}),
      line('response_item', {
        type: 'message',
        role: 'user',
        content: [{ text: 'First question' }, { type: 'image' }],
      }),
      line('response_item', {
        type: 'message',
        role: 'assistant',
        content: [{ text: 'Answer' }],
      }),
      line('response_item', {
        type: 'message',
        role: 'assistant',
        content: [],
      }),
      line('response_item', {
        type: 'message',
        role: 'other',
        content: [],
      }),
      line('response_item', {
        type: 'function_call',
        call_id: 'c1',
        name: 'exec_command',
        arguments: '{"cmd":"pnpm test"}',
      }),
      line('response_item', {
        type: 'function_call',
        id: 'c2',
        name: 'read_file',
        arguments: '{bad',
      }),
      line('response_item', {
        type: 'function_call',
        arguments: '{"command":"pwd"}',
      }),
      line('response_item', { type: 'function_call' }),
      line('response_item', {
        type: 'function_call_output',
        call_id: 'c1',
        output: '{"output":"ok"}',
      }),
      line('response_item', {
        type: 'function_call_output',
        call_id: 'c2',
        output: 'raw',
      }),
      line('response_item', { type: 'function_call_output' }),
      line('response_item', {
        type: 'custom_tool_call',
        id: 'custom-1',
        call_id: 'c3',
        name: 'exec',
        input: '{"cmd":"pnpm check"}',
      }),
      line('response_item', {
        type: 'custom_tool_call_output',
        id: 'custom-output-1',
        call_id: 'c3',
        output: [{
          type: 'input_text',
          text: 'all green',
        }],
      }),
      line('response_item', {
        type: 'reasoning',
        id: 'reasoning-1',
        summary: [{
          type: 'summary_text',
          text: 'Checking the gate',
        }],
      }),
      line('response_item', { type: 'unsupported' }),
      line('event_msg', {
        type: 'token_count',
        info: {
          last_token_usage: {
            input_tokens: 10,
            cached_input_tokens: 4,
            cache_write_input_tokens: 2,
            output_tokens: 3,
          },
        },
      }),
    ].join('\n');
    const parsed = parseCodexHistory(content);

    expect(parsed).toMatchObject({
      actualSessionId: 'thread-1',
      cwd: '/repo',
      title: 'First question',
    });
    expect(parsed.entries).toHaveLength(14);
    expect(JSON.stringify(parsed.entries)).toContain('pnpm test');
    expect(JSON.stringify(parsed.entries)).toContain('pnpm check');
    expect(JSON.stringify(parsed.entries)).toContain('all green');
    expect(JSON.stringify(parsed.entries)).toContain('Checking the gate');
    expect(JSON.stringify(parsed.entries)).toContain('Conversation compacted');
    expect(JSON.stringify(parsed.entries)).toContain('raw');
    expect(parsed.entries.at(-1)).toMatchObject({
      kind: 'assistant',
      usage: {
        inputTokens: 10,
        outputTokens: 3,
        cacheCreationTokens: 2,
        cacheReadTokens: 4,
      },
    });
  });

  test('uses fallbacks for incomplete history', () => {
    const parsed = parseCodexHistory([
      line('turn_context', { cwd: '/fallback' }),
      line('event_msg', {
        type: 'token_count',
        info: { last_token_usage: {} },
      }),
      line('event_msg', { type: 'token_count' }),
      line('response_item', {
        type: 'reasoning',
        summary: [{ type: 'summary_text' }],
      }),
      line('response_item', { type: 'reasoning' }),
      line('response_item', {
        type: 'custom_tool_call_output',
        output: [{ type: 'input_text' }],
      }),
      line('response_item', {
        type: 'message',
        role: 'user',
        content: [],
      }, ''),
    ].join('\n'));

    expect(parsed).toMatchObject({
      cwd: '/fallback',
      firstTimestampMs: Date.parse('2026-01-01T00:00:00.000Z'),
      lastTimestampMs: Date.parse('2026-01-01T00:00:00.000Z'),
    });
    expect(parseCodexHistory('{}').cwd).toBe('unknown');
    expect(parseCodexHistory('42').cwd).toBe('unknown');
    expect(parseCodexHistory('null').cwd).toBe('unknown');
    expect(parseCodexHistory([
      line('session_meta', {}),
      line('response_item', {
        type: 'message',
        role: 'user',
      }),
    ].join('\n')).cwd).toBe('unknown');
  });

  test('titles a session from the first typed turn, not the injected preamble', () => {
    const preamble = '<environment_context><cwd>/repo</cwd></environment_context>';
    const parsed = parseCodexHistory([
      line('session_meta', {
        id: 'a',
        cwd: '/repo',
      }),
      line('response_item', {
        type: 'message',
        role: 'user',
        content: [{ text: preamble }],
      }),
      line('response_item', {
        type: 'message',
        role: 'user',
        content: [{ text: 'Fix the parser\n<recommended_plugins>catalog</recommended_plugins>' }],
      }),
    ].join('\n'));

    expect(parsed.title).toBe('Fix the parser');
    expect(parsed.entries[0]).toMatchObject({
      kind: 'user',
      meta: true,
    });
    expect(parsed.entries[1]).toMatchObject({
      kind: 'user',
      meta: false,
      text: 'Fix the parser',
      injectedText: '<recommended_plugins>catalog</recommended_plugins>',
    });
  });

  test('titles a session with the file name behind a file URL first message', () => {
    const parsed = parseCodexHistory([
      line('session_meta', {
        id: 'a',
        cwd: '/repo',
      }),
      line('response_item', {
        type: 'message',
        role: 'user',
        content: [{ text: 'file:///Users/dev/DNCR_Screen.png' }],
      }),
    ].join('\n'));

    expect(parsed.title).toBe('DNCR_Screen.png');
  });
});

describe('Codex history discovery', () => {
  test('discovers active and archived rollouts grouped by cwd', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codex-history-'));
    const active = join(root, 'sessions', '2026', '01');
    const archived = join(root, 'archived_sessions');

    await mkdir(active, { recursive: true });
    await mkdir(archived, { recursive: true });
    await writeFile(join(active, 'rollout-a.jsonl'), history('a', '/repo/alpha'));
    await writeFile(join(active, 'rollout-a2.jsonl'), history('a2', '/repo/alpha'));
    await writeFile(join(archived, 'rollout-b.jsonl'), history('b', '/repo/beta'));
    await writeFile(join(archived, 'rollout-unknown.jsonl'), [
      line('session_meta', { id: 'unknown' }),
      line('response_item', {
        type: 'message',
        role: 'user',
        content: [{ text: 'Mystery' }],
      }),
    ].join('\n'));
    await writeFile(join(active, 'ignore.txt'), 'nope');
    await writeFile(join(active, 'rollout-empty.jsonl'), '{}');
    await symlink(join(active, 'rollout-a.jsonl'), join(active, 'rollout-link.jsonl'));

    const projects = await listCodexProjects(root);
    const sessions = await listCodexSessions(root, '/repo/alpha');

    expect(projects.map((project) => {
      return project.name;
    })).toEqual(expect.arrayContaining(['alpha', 'beta']));
    expect(sessions).toHaveLength(2);
    expect(sessions).toContainEqual(expect.objectContaining({
      agent: 'codex',
      actualSessionId: 'a',
      title: 'Build it',
    }));
    expect(await loadCodexEntries(sessions[0]?.filePath ?? '')).toHaveLength(2);
    expect(await loadCodexEntries('/missing.jsonl')).toBeUndefined();
    expect(await listCodexSessions(root, '/missing')).toEqual([]);
    expect(projects).toContainEqual(expect.objectContaining({
      name: 'Unknown project',
      actualPath: undefined,
    }));
  });

  test('handles absent history folders', async () => {
    const root = await mkdtemp(join(tmpdir(), 'codex-empty-'));

    expect(await listCodexProjects(root)).toEqual([]);
  });
});

describe('codex events that carry a whole call', () => {
  test('reads an mcp call and its result from the one event that reports them', () => {
    const session = parseCodexHistory([
      line('session_meta', {
        id: 's1',
        cwd: '/repo',
      }),
      line('event_msg', {
        type: 'mcp_tool_call_end',
        call_id: 'mcp-1',
        invocation: {
          server: 'node_repl',
          tool: 'js',
          arguments: { command: 'ls' },
        },
        result: {
          Ok: {
            content: [{
              type: 'text',
              text: 'ran it',
            }],
          },
        },
      }),
    ].join('\n'));

    const call = session.entries.find((entry) => {
      return entry.kind === 'assistant';
    });

    if (call?.kind !== 'assistant' || call.blocks[0]?.blockType !== 'tool-use') {
      throw new Error('expected an mcp tool call');
    }

    expect(call.blocks[0].call.serverName).toBe('node_repl');
    expect(call.blocks[0].call.name).toBe('js');

    const outcome = session.entries.find((entry) => {
      return entry.kind === 'user' && entry.outcomes.length > 0;
    });

    if (outcome?.kind !== 'user') {
      throw new Error('expected an mcp outcome');
    }

    expect(outcome.outcomes[0]).toMatchObject({
      toolUseId: 'mcp-1',
      status: 'ok',
      text: 'ran it',
    });
  });

  test('reports an mcp call that failed', () => {
    const session = parseCodexHistory([
      line('session_meta', {
        id: 's2',
        cwd: '/repo',
      }),
      line('event_msg', {
        type: 'mcp_tool_call_end',
        call_id: 'mcp-2',
        invocation: {
          tool: 'js',
        },
        result: { Err: 'server unreachable' },
      }),
    ].join('\n'));
    const outcome = session.entries.find((entry) => {
      return entry.kind === 'user' && entry.outcomes.length > 0;
    });

    if (outcome?.kind !== 'user') {
      throw new Error('expected an mcp outcome');
    }

    expect(outcome.outcomes[0]).toMatchObject({
      status: 'error',
      text: 'server unreachable',
    });
  });

  test('falls back when the event names neither the tool nor the call, and returns nothing', () => {
    const session = parseCodexHistory([
      line('session_meta', {
        id: 's5',
        cwd: '/repo',
      }),
      line('event_msg', {
        type: 'mcp_tool_call_end',
        invocation: { server: 'node_repl' },
        result: { Ok: { content: [{ type: 'image' }] } },
      }),
    ].join('\n'));
    const call = session.entries.find((entry) => {
      return entry.kind === 'assistant';
    });
    const outcome = session.entries.find((entry) => {
      return entry.kind === 'user' && entry.outcomes.length > 0;
    });

    if (call?.kind !== 'assistant' || call.blocks[0]?.blockType !== 'tool-use' || outcome?.kind !== 'user') {
      throw new Error('expected an mcp call and its outcome');
    }

    expect(call.blocks[0].call.name).toBe('tool');
    expect(call.blocks[0].call.id).toBe(outcome.outcomes[0]?.toolUseId);
    expect(outcome.outcomes[0]?.text).toBeUndefined();
  });

  test('ignores an mcp event with no invocation to describe', () => {
    const session = parseCodexHistory([
      line('session_meta', {
        id: 's3',
        cwd: '/repo',
      }),
      line('event_msg', { type: 'mcp_tool_call_end' }),
    ].join('\n'));

    expect(session.entries).toEqual([]);
  });

  test('marks a compaction that arrives as a response item', () => {
    const session = parseCodexHistory([
      line('session_meta', {
        id: 's4',
        cwd: '/repo',
      }),
      line('response_item', {
        type: 'compaction',
        id: 'cmp_1',
        encrypted_content: 'opaque',
      }),
    ].join('\n'));

    expect(session.entries).toEqual([{
      kind: 'summary',
      text: 'Conversation compacted',
    }]);
  });
});
