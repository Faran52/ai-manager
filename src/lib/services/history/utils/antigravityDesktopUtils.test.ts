import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import {
  listAntigravityDesktopProjects,
  listAntigravityDesktopSessions,
  loadAntigravityDesktopEntries,
} from './antigravityDesktopUtils';

interface StoreOptions {
  readonly artifacts?: Readonly<Record<string, string>>;
  readonly manifest?: string;
  readonly conversation?: Uint8Array;
}

const SESSION = 'session-one';

const storeWith = async (options: StoreOptions = {}): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'antigravity-'));
  const dir = join(root, 'brain', SESSION);

  await mkdir(dir, { recursive: true });
  await mkdir(join(root, 'conversations'), { recursive: true });

  const artifacts = options.artifacts ?? {
    'task.md': '# Ship the reader\n\nRead the desktop store.',
    'implementation_plan.md': '# Plan\n\nStep one.',
  };

  for (const [name, text] of Object.entries(artifacts)) {
    await writeFile(join(dir, name), text);
  }

  if (options.manifest != null) {
    await writeFile(join(dir, 'manifest.json'), options.manifest);
  }

  if (options.conversation != null) {
    await writeFile(join(root, 'conversations', `${SESSION}.pb`), options.conversation);
  }

  return root;
};

const framed = (phrases: readonly string[]): Uint8Array => {
  const binary = [0x0a, 0x00, 0xff, 0x7f, 0x1b];
  const bytes = phrases.flatMap((phrase) => {
    return [...binary, ...Buffer.from(phrase, 'latin1')];
  });

  return Uint8Array.from([...bytes, ...binary]);
};

test('reads a session out of the artifacts it produced', async () => {
  const root = await storeWith();
  const sessions = await listAntigravityDesktopSessions('antigravity', [root]);

  expect(sessions).toHaveLength(1);
  expect(sessions[0]?.id).toBe(SESSION);
  expect(sessions[0]?.title).toBe('Ship the reader');
  expect(sessions[0]?.messageCount).toBeGreaterThan(0);
});

test('reads the task as the ask and the rest as the work', async () => {
  const root = await storeWith();
  const entries = await loadAntigravityDesktopEntries(join(root, 'brain', SESSION));

  expect(entries?.map((entry) => {
    return entry.kind;
  })).toEqual(['user', 'assistant']);
  expect(entries?.[0]).toMatchObject({ text: '# Ship the reader\n\nRead the desktop store.' });
});

test('counts a tool from the plain text inside the protobuf', async () => {
  const root = await storeWith({
    conversation: framed(['Opening URL', 'taking screenshot', 'Opening url']),
  });
  const entries = await loadAntigravityDesktopEntries(join(root, 'brain', SESSION));
  const assistant = entries?.find((entry) => {
    return entry.kind === 'assistant';
  });
  const tools = assistant?.kind === 'assistant'
    ? assistant.blocks.flatMap((block) => {
        return block.blockType === 'tool-use' ? [block.call.name] : [];
      })
    : [];

  expect(tools).toEqual(['BrowserOpenUrl', 'BrowserOpenUrl', 'BrowserScreenshot']);
});

test('groups sessions by the workspace the manifest names', async () => {
  const root = await storeWith({ manifest: JSON.stringify({ workspace: '/repo/alpha' }) });
  const projects = await listAntigravityDesktopProjects('antigravity', [root]);

  expect(projects).toEqual([expect.objectContaining({
    id: '/repo/alpha',
    name: 'alpha',
    sessionCount: 1,
  })]);
});

test('keeps a session the manifest never placed', async () => {
  const projects = await listAntigravityDesktopProjects('antigravity', [await storeWith()]);

  expect(projects[0]).toMatchObject({
    id: 'unplaced',
    name: 'Unplaced conversations',
  });
});

test('skips a session directory holding no artifacts', async () => {
  const root = await storeWith({ artifacts: {} });

  expect(await listAntigravityDesktopSessions('antigravity', [root])).toEqual([]);
});

test('takes the first heading it finds when the task has none', async () => {
  const root = await storeWith({
    artifacts: {
      'task.md': 'no heading here',
      'walkthrough.md': '## What happened',
    },
  });
  const sessions = await listAntigravityDesktopSessions('antigravity', [root]);

  expect(sessions[0]?.title).toBe('What happened');
});

test('reads nothing from a root with no brain directory', async () => {
  const empty = await mkdtemp(join(tmpdir(), 'antigravity-empty-'));

  expect(await listAntigravityDesktopSessions('antigravity', [empty])).toEqual([]);
  expect(await listAntigravityDesktopProjects('antigravity', [empty])).toEqual([]);
});

test('reads nothing from a path that is not a session directory', async () => {
  const root = await storeWith();

  expect(await loadAntigravityDesktopEntries(join(root, 'brain', SESSION, 'task.md')))
    .toBeUndefined();
  expect(await loadAntigravityDesktopEntries(join(root, 'brain', 'missing'))).toBeUndefined();
});

test('ignores a manifest that is broken or names no workspace', async () => {
  const broken = await storeWith({ manifest: '{ truncated' });
  const empty = await storeWith({ manifest: JSON.stringify({ workspace: '' }) });

  expect((await listAntigravityDesktopProjects('antigravity', [broken]))[0]?.id).toBe('unplaced');
  expect((await listAntigravityDesktopProjects('antigravity', [empty]))[0]?.id).toBe('unplaced');
});

test('filters sessions to the project asked for', async () => {
  const root = await storeWith({ manifest: JSON.stringify({ workspace: '/repo/alpha' }) });

  expect(await listAntigravityDesktopSessions('antigravity', [root], '/repo/alpha'))
    .toHaveLength(1);
  expect(await listAntigravityDesktopSessions('antigravity', [root], '/repo/other'))
    .toEqual([]);
});

test('reads a session that produced work without recording a task', async () => {
  const root = await storeWith({ artifacts: { 'walkthrough.md': '# Done\n\nAll of it.' } });
  const entries = await loadAntigravityDesktopEntries(join(root, 'brain', SESSION));

  expect(entries?.map((entry) => {
    return entry.kind;
  })).toEqual(['assistant']);
});

test('reads nothing from a session directory holding no artifacts', async () => {
  const root = await storeWith({ artifacts: {} });

  expect(await loadAntigravityDesktopEntries(join(root, 'brain', SESSION))).toBeUndefined();
});

test('reads a session that only ever recorded its task', async () => {
  const root = await storeWith({ artifacts: { 'task.md': '# Just the ask' } });
  const entries = await loadAntigravityDesktopEntries(join(root, 'brain', SESSION));

  expect(entries?.map((entry) => {
    return entry.kind;
  })).toEqual(['user']);
});

test('leaves a session unnamed when no artifact carries a heading', async () => {
  const root = await storeWith({ artifacts: { 'task.md': '#\n\nplain body' } });
  const sessions = await listAntigravityDesktopSessions('antigravity', [root]);

  expect(sessions[0]?.title).toBeUndefined();
});

test('takes the workspace under either name the manifest uses', async () => {
  const root = await storeWith({ manifest: JSON.stringify({ workspacePath: '/repo/beta' }) });
  const projects = await listAntigravityDesktopProjects('antigravity', [root]);

  expect(projects[0]?.id).toBe('/repo/beta');
});

test('ignores a manifest that is not an object at all', async () => {
  const root = await storeWith({ manifest: '[]' });
  const projects = await listAntigravityDesktopProjects('antigravity', [root]);

  expect(projects[0]?.id).toBe('unplaced');
});

test('skips an artifact file that was left empty', async () => {
  const root = await storeWith({
    artifacts: {
      'task.md': '   \n\n  ',
      'walkthrough.md': '# Only this one',
    },
  });
  const sessions = await listAntigravityDesktopSessions('antigravity', [root]);

  expect(sessions[0]?.title).toBe('Only this one');
});
