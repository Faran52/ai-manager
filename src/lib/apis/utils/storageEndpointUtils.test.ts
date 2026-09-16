import {
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
  jsonOf,
  post,
  stubAgentEnv,
} from '@mocks/endpointRequestFixtures';

import { handleReclaimStorage, handleStorageReport } from './storageEndpointUtils';

stubAgentEnv();

describe('storage reclaim endpoint', () => {
  test('removes rebuildable working files and reports what it freed', async () => {
    const home = await mkdtemp(join(tmpdir(), 'reclaim-api-'));
    const cache = join(home, '.claude', 'cache');

    await mkdir(cache, { recursive: true });
    await writeFile(join(cache, 'blob'), 'x'.repeat(500), 'utf8');

    const response = await handleReclaimStorage(post({ paths: [cache] }), { home });

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({
      result: {
        removed: [cache],
        freedBytes: 500,
        refused: [],
      },
    });
  });

  test('refuses anything that is not rebuildable', async () => {
    const home = await mkdtemp(join(tmpdir(), 'reclaim-api-'));
    const projects = join(home, '.claude', 'projects');

    await mkdir(projects, { recursive: true });
    await writeFile(join(projects, 'a.jsonl'), 'kept', 'utf8');

    expect(await jsonOf(await handleReclaimStorage(post({ paths: [projects] }), { home })))
      .toMatchObject({ result: { refused: [projects] } });
  });

  test('falls back to the real home when none is given', async () => {
    const response = await handleReclaimStorage(post({ paths: ['/definitely/not/a/cache'] }));

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({
      result: {
        removed: [],
        refused: ['/definitely/not/a/cache'],
      },
    });
  });

  test('rejects a request that names no paths', async () => {
    expect((await handleReclaimStorage(post({}))).status).toBe(400);
    expect((await handleReclaimStorage(post({ paths: [] }))).status).toBe(400);
    expect((await handleReclaimStorage(post({ paths: [4] }))).status).toBe(400);
    expect((await handleReclaimStorage(post('nonsense'))).status).toBe(400);
  });
});

describe('storage endpoint', () => {
  test('reports what the agents hold', { timeout: 30_000 }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'storage-api-'));

    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(join(home, '.claude', 'big.jsonl'), 'x'.repeat(500), 'utf8');

    const response = await handleStorageReport({ home });

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({ agents: [{ agent: 'claude' }] });
  });

  test('measures the real home when the caller names none', { timeout: 30_000 }, async () => {
    const response = await handleStorageReport();

    expect(response.status).toBe(200);
  });
});
