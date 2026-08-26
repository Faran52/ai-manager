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
      line('response_item', { type: 'unsupported' }),
      line('event_msg', { type: 'token_count' }),
    ].join('\n');
    const parsed = parseCodexHistory(content);

    expect(parsed).toMatchObject({
      actualSessionId: 'thread-1',
      cwd: '/repo',
      title: 'First question',
    });
    expect(parsed.entries).toHaveLength(11);
    expect(JSON.stringify(parsed.entries)).toContain('pnpm test');
    expect(JSON.stringify(parsed.entries)).toContain('Conversation compacted');
    expect(JSON.stringify(parsed.entries)).toContain('raw');
  });

  test('uses fallbacks for incomplete history', () => {
    const parsed = parseCodexHistory([
      line('turn_context', { cwd: '/fallback' }),
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
