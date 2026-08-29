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

import { listTree } from './treeUtils';

const newTree = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'tree-'));

  await mkdir(join(root, 'a', 'b'), { recursive: true });
  await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true });
  await writeFile(join(root, 'top.txt'), 'x', 'utf8');
  await writeFile(join(root, 'a', 'nested.txt'), 'x', 'utf8');
  await writeFile(join(root, 'a', 'b', 'deep.txt'), 'x', 'utf8');
  await writeFile(join(root, 'node_modules', 'pkg', 'ignored.txt'), 'x', 'utf8');

  return root;
};

const names = (paths: readonly string[]): readonly string[] => {
  return [...paths].map((path) => {
    return path.split('/').at(-1) ?? '';
  }).sort((left, right) => {
    return left.localeCompare(right);
  });
};

describe('listTree', () => {
  test('finds every file a scan is allowed to reach', async () => {
    expect(names(await listTree(await newTree(), 6)))
      .toEqual(['deep.txt', 'nested.txt', 'top.txt']);
  });

  test('stops descending once it has gone deep enough', async () => {
    expect(names(await listTree(await newTree(), 1))).toEqual(['nested.txt', 'top.txt']);
  });

  test('reads one tree once when two scans ask for it at the same time', async () => {
    const root = await newTree();
    const [left, right] = await Promise.all([listTree(root, 6), listTree(root, 6)]);

    expect(left).toBe(right);
  });

  test('sees a change made after an earlier scan finished', async () => {
    const root = await newTree();

    await listTree(root, 6);
    await writeFile(join(root, 'later.txt'), 'x', 'utf8');

    expect(names(await listTree(root, 6))).toContain('later.txt');
  });

  test('treats a single file as the whole of its own tree', async () => {
    const root = await newTree();

    expect(await listTree(join(root, 'top.txt'), 6)).toEqual([join(root, 'top.txt')]);
  });

  test('reports nothing for somewhere it cannot look', async () => {
    const root = await newTree();
    const locked = join(root, 'locked');

    await mkdir(locked);
    await chmod(locked, 0o000);

    expect(await listTree(locked, 6)).toEqual([]);

    await chmod(locked, 0o700);
    expect(await listTree('/missing/place', 6)).toEqual([]);
  });
});
