import {
  mkdtemp,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
} from 'vitest';

import { fileFactsStore } from './fileFactsUtils';

interface Measured {
  readonly length: number;
}

interface Counter {
  readonly derive: (content: string) => Measured;
  readonly reads: () => number;
}

const newFile = async (content: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'file-facts-'));
  const path = join(dir, 'session.jsonl');

  await writeFile(path, content, 'utf8');

  return path;
};

const counter = (): Counter => {
  let reads = 0;

  return {
    derive: (content) => {
      reads += 1;

      return { length: content.length };
    },
    reads: () => {
      return reads;
    },
  };
};

describe('fileFactsStore', () => {
  test('reads a file once while it stays as it was', async () => {
    const store = fileFactsStore<Measured>(8);
    const path = await newFile('hello');
    const { derive, reads } = counter();

    expect(await store(path, derive)).toMatchObject({
      length: 5,
      sizeBytes: 5,
    });
    expect(await store(path, derive)).toMatchObject({ length: 5 });
    expect(reads()).toBe(1);
  });

  test('reads it again once its content changed', async () => {
    const store = fileFactsStore<Measured>(8);
    const path = await newFile('hello');
    const { derive, reads } = counter();

    await store(path, derive);
    await writeFile(path, 'hello again', 'utf8');

    expect(await store(path, derive)).toMatchObject({ length: 11 });
    expect(reads()).toBe(2);
  });

  test('reads it again when it was touched at the same size', async () => {
    const store = fileFactsStore<Measured>(8);
    const path = await newFile('abcde');
    const { derive, reads } = counter();

    await store(path, derive);
    await utimes(path, new Date(), new Date(Date.now() + 60_000));
    await store(path, derive);

    expect(reads()).toBe(2);
  });

  test('reports nothing for a file that is not there', async () => {
    const store = fileFactsStore<Measured>(8);

    expect(await store('/missing/session.jsonl', (content) => {
      return { length: content.length };
    })).toBeUndefined();
  });
});
