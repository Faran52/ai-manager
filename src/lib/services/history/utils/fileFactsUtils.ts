import { readFile, stat } from 'node:fs/promises';

import { LruCache } from '@utils/lruCacheUtils';

export interface FileFacts {
  readonly modifiedMs: number;
  readonly sizeBytes: number;
}

interface Cached<T> extends FileFacts {
  readonly value: T;
}

/*
 * Parsing is the expensive part, so a conclusion is kept against the size and mtime
 * it came from. Each caller gets its own store: what is worth keeping differs.
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
