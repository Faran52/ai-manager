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
  listAntigravityProjects,
  listAntigravitySessions,
  loadAntigravityEntries,
  parseAntigravityTranscript,
} from './antigravityUtils';

const STAMP = Date.parse('2026-04-01T08:00:00.000Z');
const ISO = new Date(STAMP).toISOString();
const CONVERSATION = 'conv-1';

const transcript = [
  JSON.stringify({
    step_index: 0,
    source: 'USER_EXPLICIT',
    type: 'USER_INPUT',
    created_at: ISO,
    content: 'Add a retry',
  }),
  JSON.stringify({
    step_index: 1,
    source: 'MODEL',
    type: 'PLANNER_RESPONSE',
    created_at: new Date(STAMP + 1000).toISOString(),
    content: 'Adding one now.',
  }),
  JSON.stringify({
    step_index: 2,
    source: 'MODEL',
    type: 'SEARCH_WEB',
    created_at: new Date(STAMP + 2000).toISOString(),
    content: 'Looked up the retry policy.',
  }),
  JSON.stringify({
    step_index: 3,
    source: 'MODEL',
    type: 'CONVERSATION_HISTORY',
    content: 'replayed context',
  }),
  JSON.stringify({
    step_index: 4,
    source: 'SYSTEM',
    content: 'bookkeeping',
  }),
  JSON.stringify({
    step_index: 5,
    source: 'MODEL',
    type: 'PLANNER_RESPONSE',
  }),
  JSON.stringify({
    step_index: 6,
    source: 'SOMETHING_NEW',
    content: 'unknown source',
  }),
  'not json',
  '',
].join('\n');

const historyLine = (overrides: object): string => {
  return JSON.stringify({
    display: 'Add a retry',
    timestamp: STAMP,
    workspace: '/repo/alpha',
    conversationId: CONVERSATION,
    ...overrides,
  });
};

describe('parseAntigravityTranscript', () => {
  test('keeps user prompts and model turns, drops replay and bookkeeping', () => {
    const entries = parseAntigravityTranscript(transcript, CONVERSATION, STAMP);

    expect(entries.map((entry) => {
      return entry.kind;
    })).toEqual(['user', 'assistant', 'assistant']);
    expect(entries[0]).toMatchObject({
      uuid: 'conv-1-step-0',
      text: 'Add a retry',
    });
  });

  test('shows a non-planner model step as the tool it used', () => {
    const entries = parseAntigravityTranscript(transcript, CONVERSATION, STAMP);
    const planner = entries[1];
    const search = entries[2];

    expect(planner?.kind === 'assistant' ? planner.blocks : []).toEqual([{
      blockType: 'text',
      text: 'Adding one now.',
    }]);
    expect((search?.kind === 'assistant' ? search.blocks : []).map((block) => {
      return block.blockType === 'tool-use' ? block.call.name : block.blockType;
    })).toEqual(['SEARCH_WEB', 'text']);
  });

  test('carries the last seen time forward across stampless steps', () => {
    const entries = parseAntigravityTranscript([
      JSON.stringify({
        source: 'USER_EXPLICIT',
        created_at: ISO,
        content: 'first',
      }),
      JSON.stringify({
        source: 'MODEL',
        content: 'no stamp of its own',
      }),
    ].join('\n'), CONVERSATION, 0);

    expect(entries[1]?.timestamp).toBe(ISO);
  });

  test('falls back to the line number when a step is unnumbered', () => {
    const entries = parseAntigravityTranscript(JSON.stringify({
      source: 'USER_EXPLICIT',
      content: 'no index',
    }), CONVERSATION, STAMP);

    expect(entries[0]?.uuid).toBe('conv-1-step-0');
  });

  test('separates injected context from what the user typed', () => {
    const entries = parseAntigravityTranscript(JSON.stringify({
      source: 'USER_EXPLICIT',
      content: 'Ship it\n<environment_context>hidden</environment_context>',
    }), CONVERSATION, STAMP);

    expect(entries[0]).toMatchObject({
      text: 'Ship it',
      injectedText: '<environment_context>hidden</environment_context>',
    });
  });
});

describe('antigravity discovery', () => {
  const writeStore = async (
    root: string,
    conversationId: string,
    body: string,
    history?: readonly string[],
  ): Promise<void> => {
    const logs = join(root, 'brain', conversationId, '.system_generated', 'logs');

    await mkdir(logs, { recursive: true });
    await writeFile(join(logs, 'transcript_full.jsonl'), body, 'utf8');

    if (history != null) {
      await writeFile(join(root, 'history.jsonl'), history.join('\n'), 'utf8');
    }
  };

  test('places a conversation in the workspace its index names', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antigravity-'));

    await writeStore(root, CONVERSATION, transcript, [
      historyLine({}),
      historyLine({ display: 'duplicate ignored' }),
      'not json',
      JSON.stringify({ display: 'no conversation id' }),
    ]);

    const projects = await listAntigravityProjects('antigravity', [root]);

    expect(projects).toEqual([expect.objectContaining({
      id: '/repo/alpha',
      name: 'alpha',
      actualPath: '/repo/alpha',
      sessionCount: 1,
    })]);

    const [session] = await listAntigravitySessions('antigravity', [root]);

    expect(session).toMatchObject({
      title: 'Add a retry',
      projectId: '/repo/alpha',
      cwd: '/repo/alpha',
    });
    expect(await listAntigravitySessions('antigravity', [root], '/repo/alpha')).toHaveLength(1);
  });

  test('groups conversations the index cannot place', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antigravity-unplaced-'));

    await writeStore(root, 'conv-lost', transcript);

    const projects = await listAntigravityProjects('antigravity', [root]);

    expect(projects).toEqual([expect.objectContaining({
      id: 'unplaced',
      name: 'Unplaced conversations',
      actualPath: undefined,
    })]);
  });

  test('skips a conversation whose transcript has nothing to show', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antigravity-empty-'));

    await writeStore(root, 'conv-empty', JSON.stringify({
      source: 'SYSTEM',
      content: 'bookkeeping only',
    }));

    expect(await listAntigravitySessions('antigravity', [root])).toEqual([]);
  });

  test('skips an unreadable transcript and a store with no brain folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antigravity-locked-'));

    await writeStore(root, 'conv-locked', transcript);

    const locked = join(root, 'brain', 'conv-locked', '.system_generated', 'logs', 'transcript_full.jsonl');

    await chmod(locked, 0o000);

    const sessions = await listAntigravitySessions('antigravity', [root]);

    await chmod(locked, 0o644);

    expect(sessions).toEqual([]);
    expect(await listAntigravityProjects('antigravity', [join(root, 'missing')])).toEqual([]);
  });

  test('loads one conversation and refuses a missing transcript', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antigravity-load-'));

    await writeStore(root, CONVERSATION, transcript, [historyLine({})]);

    const [session] = await listAntigravitySessions('antigravity', [root]);

    expect(await loadAntigravityEntries(session?.filePath ?? '')).toHaveLength(3);
    expect(await loadAntigravityEntries(join(root, 'nope.jsonl'))).toBeUndefined();
  });

  test('refuses a transcript that parses to nothing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antigravity-noise-'));

    await writeStore(root, 'conv-noise', 'not json at all');

    const path = join(root, 'brain', 'conv-noise', '.system_generated', 'logs', 'transcript_full.jsonl');

    expect(await loadAntigravityEntries(path)).toBeUndefined();
  });
});

describe('antigravity remaining paths', () => {
  test('ignores a created_at that is not a date, and a step with no source', () => {
    const entries = parseAntigravityTranscript([
      JSON.stringify({
        source: 'USER_EXPLICIT',
        created_at: 'never',
        content: 'first',
      }),
      JSON.stringify({
        type: 'USER_INPUT',
        content: 'no source at all',
      }),
    ].join('\n'), CONVERSATION, STAMP);

    expect(entries).toHaveLength(2);
    expect(entries[0]?.timestamp).toBe(ISO);
    expect(entries[1]).toMatchObject({ text: 'no source at all' });
  });

  test('orders several conversations and workspaces by recency', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antigravity-many-'));

    const write = async (id: string, at: number): Promise<void> => {
      const logs = join(root, 'brain', id, '.system_generated', 'logs');

      await mkdir(logs, { recursive: true });
      await writeFile(join(logs, 'transcript_full.jsonl'), JSON.stringify({
        source: 'USER_EXPLICIT',
        created_at: new Date(at).toISOString(),
        content: `prompt for ${id}`,
      }), 'utf8');
    };

    await write('conv-old', STAMP);
    await write('conv-new', STAMP + 60_000);
    await writeFile(join(root, 'history.jsonl'), [
      JSON.stringify({
        conversationId: 'conv-old',
        workspace: '/repo/alpha',
        display: 'older',
      }),
      JSON.stringify({
        conversationId: 'conv-new',
        workspace: '/repo/beta',
        display: 'newer',
      }),
    ].join('\n'), 'utf8');

    const sessions = await listAntigravitySessions('antigravity', [root]);
    const projects = await listAntigravityProjects('antigravity', [root]);

    expect(sessions.map((session) => {
      return session.id;
    })).toEqual(['conv-new', 'conv-old']);
    expect(projects.map((project) => {
      return project.name;
    })).toEqual(['beta', 'alpha']);
  });

  test('leaves the preview empty when the model spoke first', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antigravity-nopreview-'));
    const logs = join(root, 'brain', 'conv-model', '.system_generated', 'logs');

    await mkdir(logs, { recursive: true });
    await writeFile(join(logs, 'transcript_full.jsonl'), JSON.stringify({
      source: 'MODEL',
      content: 'assistant only',
    }), 'utf8');

    const [session] = await listAntigravitySessions('antigravity', [root]);

    expect(session?.preview).toBeUndefined();
  });
});
