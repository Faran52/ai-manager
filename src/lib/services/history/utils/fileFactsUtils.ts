import { readFile, stat } from 'node:fs/promises';

import { LruCache } from '@utils/lruCacheUtils';

export interface FileFacts {
  readonly modifiedMs: number;
  readonly sizeBytes: number;
}

interface Cached<T> extends FileFacts {
  readonly value: T;
}

/**
 * Listing a project and reporting on it both read the same transcripts, and a
 * report reads them for every project it covers. Parsing is the expensive part,
 * so what a parse concluded is kept against the size and mtime it concluded it
 * from, and only a file that has actually changed is read again.
 *
 * Each caller gets its own store because what is worth keeping differs by
 * format, and because the whole point is to keep the conclusion rather than the
 * transcript it came from.
 */
export const fileFactsStore = <T>(capacity: number): (
  filePath: string,
  derive: (content: string) => T,
) => Promise<(T & FileFacts) | undefined> => {
  const cache = new LruCache<Cached<T>>(capacity);

  return async (filePath: string, derive: (content: string) => T) => {
    let facts: FileFacts;

    try {
      const info = await stat(filePath);

      facts = {
        modifiedMs: info.mtimeMs,
        sizeBytes: info.size,
      };
    }
    /* v8 ignore next -- the file can disappear between directory scan and read */
    catch {
      return undefined;
    }

    const known = cache.get(filePath);

    if (known?.modifiedMs === facts.modifiedMs && known.sizeBytes === facts.sizeBytes) {
      return {
        ...known.value,
        ...facts,
      };
    }

    let value: T;

    try {
      value = derive(await readFile(filePath, 'utf8'));
    }
    /* v8 ignore next -- the file can disappear between the stat and the read */
    catch {
      return undefined;
    }

    cache.set(filePath, {
      ...facts,
      value,
    });

    return {
      ...value,
      ...facts,
    };
  };
};
