import {
  mkdtemp,
  rm,
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
} from 'vitest';

import { repoRootOf, withRepoRoots } from './worktreeUtils';

import type { ProjectSummary } from '../types';

const project = (overrides: Partial<ProjectSummary> = {}): ProjectSummary => {
  return {
    agent: 'claude',
    id: 'p1',
    name: 'app',
    actualPath: '/repo/app',
    sessionCount: 2,
    messageCount: 8,
    lastActivityMs: 10,
    ...overrides,
  };
};

describe('repoRootOf', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'aim-worktree-'));
  });

  afterEach(async () => {
    await rm(root, {
      recursive: true,
      force: true,
    });
  });

  test('names the repository a linked worktree belongs to', async () => {
    await writeFile(join(root, '.git'), 'gitdir: /repo/app/.git/worktrees/feature-x\n', 'utf8');

    expect(await repoRootOf(root)).toBe('/repo/app');
  });

  test('tolerates the whitespace git writes around the pointer', async () => {
    await writeFile(join(root, '.git'), '  gitdir:   /repo/app/.git/worktrees/wt  \n\n', 'utf8');

    expect(await repoRootOf(root)).toBe('/repo/app');
  });

  test('says nothing for a folder with no git marker at all', async () => {
    expect(await repoRootOf(root)).toBeUndefined();
  });

  test('says nothing for a main tree, whose .git is a directory', async () => {
    // Reading a directory as a file throws, which is the same answer as absent.
    await writeFile(join(root, 'other'), 'x', 'utf8');

    expect(await repoRootOf(join(root, 'missing'))).toBeUndefined();
  });

  test.each([
    ['a marker that is not a gitdir pointer', 'ref: refs/heads/main\n'],
    ['worktrees naming a folder rather than the segment', 'gitdir: /repo/worktrees/app/.git\n'],
    ['a pointer with no worktrees segment at all', 'gitdir: /repo/app/.git\n'],
  ])('says nothing for %s', async (_case, marker) => {
    await writeFile(join(root, '.git'), marker, 'utf8');

    expect(await repoRootOf(root)).toBeUndefined();
  });
});

describe('withRepoRoots', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'aim-worktree-'));
  });

  afterEach(async () => {
    await rm(root, {
      recursive: true,
      force: true,
    });
  });

  test('tags a worktree project with the repository that owns it', async () => {
    await writeFile(join(root, '.git'), 'gitdir: /repo/app/.git/worktrees/feature-x\n', 'utf8');

    const tagged = await withRepoRoots([
      project({ actualPath: '/repo/app' }),
      project({
        id: 'p2',
        name: 'feature-x',
        actualPath: root,
      }),
      // A store that records no folder at all is left exactly as it came.
      project({
        id: 'p3',
        actualPath: undefined,
      }),
    ]);

    expect(tagged[0]?.repoPath).toBeUndefined();
    expect(tagged[1]?.repoPath).toBe('/repo/app');
    expect(tagged[2]?.repoPath).toBeUndefined();
  });

  test('hands back the very same list when nothing is a worktree', async () => {
    const projects = [project(), project({
      id: 'p2',
      actualPath: undefined,
    })];

    expect(await withRepoRoots(projects)).toBe(projects);
  });

  test('reads a folder once however many agents report it', async () => {
    await writeFile(join(root, '.git'), 'gitdir: /repo/app/.git/worktrees/wt\n', 'utf8');

    const tagged = await withRepoRoots([
      project({ actualPath: root }),
      project({
        id: 'p2',
        agent: 'codex',
        actualPath: root,
      }),
    ]);

    expect(tagged.map((entry) => {
      return entry.repoPath;
    })).toEqual(['/repo/app', '/repo/app']);
  });
});
