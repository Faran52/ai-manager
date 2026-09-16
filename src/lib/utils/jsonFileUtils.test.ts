import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import { readJsonFile } from './jsonFileUtils';

test('reads a JSON object and answers null for a missing or malformed file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'json-file-'));

  await writeFile(join(dir, 'ok.json'), '{"a":1}', 'utf8');
  await writeFile(join(dir, 'bad.json'), '{', 'utf8');

  expect(await readJsonFile(join(dir, 'ok.json'))).toEqual({ a: 1 });
  expect(await readJsonFile(join(dir, 'bad.json'))).toBeNull();
  expect(await readJsonFile(join(dir, 'missing.json'))).toBeNull();
});
