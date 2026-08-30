import {
  mkdir,
  mkdtemp,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { resolveAgentPaths } from '../agents/agentsService';

import { listRecentEdits } from './editsService';

import type { AgentRoots } from '../agents/agentsService';
import type { RawHistoryLine } from '../history/utils/claudeRawUtils';

beforeEach(() => {
  vi.stubEnv('XDG_DATA_HOME', tmpdir());
  vi.stubEnv('XDG_CONFIG_HOME', tmpdir());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const assistantWith = (
  uuid: string,
  timestamp: string,
  name: string,
  input: object,
): RawHistoryLine => {
  return {
    type: 'assistant',
    uuid,
    timestamp,
    message: {
      role: 'assistant',
      content: [{
        type: 'tool_use',
        id: `t-${uuid}`,
        name,
        input,
      }],
    },
  };
};

const writeSession = async (
  home: string,
  name: string,
  lines: readonly RawHistoryLine[],
): Promise<void> => {
  const projectDir = join(home, '.claude', 'projects', 'proj');

  await mkdir(projectDir, { recursive: true });
  await writeFile(
    join(projectDir, `${name}.jsonl`),
    lines.map((line) => {
      return JSON.stringify(line);
    }).join('\n'),
    'utf8',
  );
};

const rootsFor = (home: string): AgentRoots => {
  return resolveAgentPaths({
    env: {},
    home,
  });
};

describe('listRecentEdits', () => {
  test('groups edits and writes by file, newest first', { timeout: 20_000 }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'edits-home-'));

    await writeSession(home, 'one', [
      assistantWith('a1', '2026-06-01T10:00:00Z', 'Edit', {
        file_path: '/repo/src/a.ts',
        old_string: 'x',
        new_string: 'y',
      }),
      assistantWith('a2', '2026-06-01T10:05:00Z', 'Write', {
        file_path: '/repo/src/b.ts',
        content: 'new file',
      }),
      assistantWith('a3', '2026-06-02T10:00:00Z', 'MultiEdit', {
        file_path: '/repo/src/a.ts',
        edits: [
          {
            old_string: '1',
            new_string: '2',
          },
          {
            old_string: '3',
            new_string: '4',
          },
        ],
      }),
    ]);

    const files = await listRecentEdits(rootsFor(home), 'claude', 'proj');

    expect(files.map((file) => {
      return file.path;
    })).toEqual(['/repo/src/a.ts', '/repo/src/b.ts']);

    const first = files[0];

    expect(first?.edits).toBe(3);
    expect(first?.writes).toBe(0);
    expect(first?.sessionCount).toBe(1);
    expect(first?.recent).toHaveLength(2);
    expect(first?.recent[0]?.timestampMs).toBe(Date.parse('2026-06-02T10:00:00Z'));
    expect(files[1]?.writes).toBe(1);
    expect(files[1]?.recent[0]?.kind).toBe('write');
  });

  test('counts a file touched from two sessions once', { timeout: 20_000 }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'edits-home-shared-'));

    await writeSession(home, 'one', [assistantWith('a1', '2026-06-01T10:00:00Z', 'Edit', {
      file_path: '/repo/shared.ts',
      old_string: 'x',
      new_string: 'y',
    })]);
    await writeSession(home, 'two', [assistantWith('b1', '2026-06-03T10:00:00Z', 'Edit', {
      file_path: '/repo/shared.ts',
      old_string: 'y',
      new_string: 'z',
    })]);

    const files = await listRecentEdits(rootsFor(home), 'claude', 'proj');

    expect(files).toHaveLength(1);
    expect(files[0]?.sessionCount).toBe(2);
    expect(files[0]?.edits).toBe(2);
  });

  test('ignores tools, empty paths and turns that change no file', { timeout: 20_000 }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'edits-home-none-'));

    await writeSession(home, 'one', [
      {
        type: 'user',
        uuid: 'u1',
        timestamp: '2026-06-01T10:00:00Z',
        message: {
          role: 'user',
          content: 'do it',
        },
      },
      {
        type: 'summary',
        summary: 'a recap',
        leafUuid: 'a1',
      },
      {
        type: 'assistant',
        uuid: 'a0',
        timestamp: '2026-06-01T10:00:30Z',
        message: {
          role: 'assistant',
          content: [{
            type: 'text',
            text: 'thinking about it',
          }],
        },
      },
      assistantWith('a1', '2026-06-01T10:01:00Z', 'Bash', { command: 'ls' }),
      assistantWith('a2', '2026-06-01T10:02:00Z', 'Edit', {
        old_string: 'x',
        new_string: 'y',
      }),
    ]);

    expect(await listRecentEdits(rootsFor(home), 'claude', 'proj')).toEqual([]);
  });

  test('falls back to the session time when a turn has none it can read', { timeout: 20_000 }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'edits-home-undated-'));

    await writeSession(home, 'one', [assistantWith('a1', 'not-a-date', 'Edit', {
      file_path: '/repo/a.ts',
      old_string: 'x',
      new_string: 'y',
    })]);

    const files = await listRecentEdits(rootsFor(home), 'claude', 'proj');

    expect(files[0]?.recent[0]?.timestampMs).not.toBeNaN();
  });

  test('skips a transcript that resolves outside the agent history folder', { timeout: 20_000 }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'edits-home-linked-'));
    const outside = await mkdtemp(join(tmpdir(), 'edits-outside-'));
    const smuggled = join(outside, 'smuggled.jsonl');

    await writeSession(home, 'one', [assistantWith('a1', '2026-06-01T10:00:00Z', 'Edit', {
      file_path: '/repo/a.ts',
      old_string: 'x',
      new_string: 'y',
    })]);
    await writeFile(smuggled, JSON.stringify(assistantWith('b1', '2026-06-02T10:00:00Z', 'Edit', {
      file_path: '/repo/secret.ts',
      old_string: 'x',
      new_string: 'y',
    })), 'utf8');
    await symlink(smuggled, join(home, '.claude', 'projects', 'proj', 'linked.jsonl'));

    const files = await listRecentEdits(rootsFor(home), 'claude', 'proj');

    expect(files.map((file) => {
      return file.path;
    })).toEqual(['/repo/a.ts']);
  });

  test('reports nothing for a project with no sessions', async () => {
    const home = await mkdtemp(join(tmpdir(), 'edits-home-empty-'));

    expect(await listRecentEdits(rootsFor(home), 'claude', 'missing')).toEqual([]);
  });
});

describe('changes an agent reported after the fact', () => {
  const writeCodexSession = async (home: string): Promise<void> => {
    const dir = join(home, '.codex', 'sessions', '2026', '06', '01');

    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'rollout-x.jsonl'), [
      JSON.stringify({
        type: 'session_meta',
        timestamp: '2026-06-01T10:00:00Z',
        payload: {
          id: 'x',
          cwd: '/repo',
        },
      }),
      JSON.stringify({
        type: 'event_msg',
        timestamp: '2026-06-01T10:01:00Z',
        payload: {
          type: 'patch_apply_end',
          call_id: 'exec-1',
          changes: {
            '/repo/src/made.ts': {
              type: 'add',
              content: 'new',
            },
            '/repo/src/changed.ts': {
              type: 'update',
              unified_diff: '@@ -1,1 +1,1 @@\n-a\n+b\n',
            },
          },
        },
      }),
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-06-01T10:01:01Z',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'call-1',
          output: 'Success',
        },
      }),
      // A result that changed nothing, so an outcome without a report is read too.
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-06-01T10:02:00Z',
        payload: {
          type: 'custom_tool_call_output',
          call_id: 'call-2',
          output: 'listed the directory',
        },
      }),
    ].join('\n'), 'utf8');
  };

  test('counts files named by the report rather than by the call', async () => {
    const home = await mkdtemp(join(tmpdir(), 'edits-codex-'));

    await writeCodexSession(home);

    const files = await listRecentEdits(rootsFor(home), 'codex', '/repo');
    const byPath = new Map(files.map((file) => {
      return [file.path, file];
    }));

    expect(byPath.get('/repo/src/made.ts')?.writes).toBe(1);
    expect(byPath.get('/repo/src/changed.ts')?.edits).toBe(1);
  });
});
