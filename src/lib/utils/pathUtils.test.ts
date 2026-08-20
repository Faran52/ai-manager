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

import { containedIn } from './pathUtils';

const workspace = async (): Promise<string> => {
  return mkdtemp(join(tmpdir(), 'containment-'));
};

describe('containedIn', () => {
  test('accepts files nested inside a root', async () => {
    const root = await workspace();
    const file = join(root, 'projects', 'a.jsonl');

    await mkdir(join(root, 'projects'), { recursive: true });
    await writeFile(file, '');

    expect(await containedIn([root], file)).toBe(true);
    expect(await containedIn([join(root, 'projects')], file)).toBe(true);
  });

  test('rejects paths outside every root', async () => {
    const root = await workspace();
    const other = join(await workspace(), 'elsewhere.jsonl');

    await writeFile(other, '');

    expect(await containedIn([root], other)).toBe(false);
  });

  test('rejects missing candidates and unusable roots', async () => {
    const root = await workspace();

    expect(await containedIn([root], join(root, 'missing.jsonl'))).toBe(false);
    expect(await containedIn([join(root, 'missing-dir')], root)).toBe(false);
  });

  test('follows symlinks to their real destination before judging', async () => {
    const root = await workspace();
    const outsideDir = await workspace();
    const outside = join(outsideDir, 'secret.jsonl');

    await writeFile(outside, '');
    await symlink(outside, join(root, 'link.jsonl'));

    expect(await containedIn([root], join(root, 'link.jsonl'))).toBe(false);
  });
});
