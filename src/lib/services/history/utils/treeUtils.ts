import { readdir, stat } from 'node:fs/promises';

import { SKIPPED_SCAN_DIRS } from '../constants';

import type { Dirent } from 'node:fs';

const childrenOf = async (dir: string): Promise<readonly Dirent[]> => {
  try {
    return await readdir(dir, { withFileTypes: true });
  }
  catch {
    return [];
  }
};

/**
 * Siblings are read together because these roots are ordinary source trees:
 * walking thousands of directories one await at a time is what made the scan
 * slow, not the work done at any single one of them.
 */
const walkDir = async (dir: string, depth: number): Promise<readonly string[]> => {
  const found = await Promise.all((await childrenOf(dir)).map(async (dirent) => {
    if (SKIPPED_SCAN_DIRS.has(dirent.name)) {
      return [];
    }

    const child = `${dir}/${dirent.name}`;

    if (dirent.isFile()) {
      return [child];
    }

    return dirent.isDirectory() && depth > 0 ? walkDir(child, depth - 1) : [];
  }));

  return found.flat();
};

/**
 * Two agents keep their history inside the projects themselves, and they are
 * pointed at the same parents. Sharing the walk while it runs means the tree is
 * read once for both rather than twice at the same moment. Nothing is kept once
 * the walk settles, so a later scan still sees the directory as it now stands.
 */
const inFlight = new Map<string, Promise<readonly string[]>>();

export const listTree = async (root: string, maxDepth: number): Promise<readonly string[]> => {
  const key = `${root} ${String(maxDepth)}`;
  const running = inFlight.get(key);

  if (running != null) {
    return running;
  }

  const walk = (async (): Promise<readonly string[]> => {
    try {
      const info = await stat(root);

      return info.isFile() ? [root] : await walkDir(root, maxDepth);
    }
    catch {
      return [];
    }
  })();

  inFlight.set(key, walk);

  try {
    return await walk;
  }
  finally {
    inFlight.delete(key);
  }
};
