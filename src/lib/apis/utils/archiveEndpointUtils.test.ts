import {
  mkdir,
  mkdtemp,
  rm,
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

import {
  isMessagesPageShape,
  jsonOf,
  newDirWithSession,
  post,
  stubAgentEnv,
} from '@mocks/endpointRequestFixtures';

import {
  handleCreateArchive,
  handleDeleteArchive,
  handleListArchives,
  handleReadArchive,
  handleRetentionStatus,
  handleRunRetention,
  handleWriteRetention,
} from './archiveEndpointUtils';
import { handleLoadSession } from './sessionEndpointUtils';

import type { ArchiveDetailResponse, CreateArchiveResponse } from '../contracts';

stubAgentEnv();

describe('archive endpoints', () => {
  const isArchiveDetail = (value: object): value is ArchiveDetailResponse => {
    return 'archive' in value;
  };

  const isCreatedArchive = (value: object): value is CreateArchiveResponse => {
    return 'archive' in value;
  };

  const archivedPathOf = (body: object | undefined): string => {
    const path = body != null && isArchiveDetail(body)
      ? body.archive?.sessions[0]?.archivePath
      : undefined;

    if (path == null) {
      throw new Error('archived path missing');
    }

    return path;
  };

  const archiveIdOf = (body: object | undefined): string => {
    if (body == null || !isCreatedArchive(body)) {
      throw new Error('archive id missing');
    }

    return body.archive.id;
  };

  test('creates, lists, reads and deletes an archive', { timeout: 30_000 }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'archive-api-'));
    const projectDir = join(home, '.claude', 'projects', 'proj');

    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 's.jsonl'), JSON.stringify({
      type: 'user',
      uuid: 'u1',
      timestamp: '2026-06-01T10:00:00Z',
      message: {
        role: 'user',
        content: 'the question',
      },
    }), 'utf8');

    const created = await handleCreateArchive(post({ note: 'first' }), { home });

    expect(created.status).toBe(200);

    const id = archiveIdOf(await jsonOf(created));
    const listed = await jsonOf(await handleListArchives({ home }));

    expect(listed).toMatchObject({
      archives: [{
        id,
        note: 'first',
        sessionCount: 1,
      }],
    });

    const read = await jsonOf(await handleReadArchive(post({ id }), { home }));

    expect(read).toMatchObject({ archive: { id } });

    const removed = await handleDeleteArchive(post({ id }), { home });

    expect(removed.status).toBe(200);
    expect(await jsonOf(await handleListArchives({ home }))).toEqual({ archives: [] });
  });

  test('creates without a note and reports an unknown archive as null', { timeout: 30_000 }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'archive-api-empty-'));
    const created = await handleCreateArchive(post({}), { home });

    expect(created.status).toBe(200);
    expect(await jsonOf(await handleReadArchive(post({ id: 'nope' }), { home }))).toEqual({ archive: null });
  });

  test('captures only the sessions a request names', { timeout: 30_000 }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'archive-api-only-'));
    const projectDir = join(home, '.claude', 'projects', 'proj');

    await mkdir(projectDir, { recursive: true });

    for (const name of ['keep', 'skip']) {
      await writeFile(join(projectDir, `${name}.jsonl`), JSON.stringify({
        type: 'user',
        uuid: `u-${name}`,
        timestamp: '2026-06-01T10:00:00Z',
        message: {
          role: 'user',
          content: name,
        },
      }), 'utf8');
    }

    const created = await jsonOf(await handleCreateArchive(post({ sessionKeys: ['claude:keep'] }), { home }));

    expect(created).toMatchObject({ archive: { sessionCount: 1 } });
  });

  test('rejects malformed archive requests', async () => {
    const home = await mkdtemp(join(tmpdir(), 'archive-api-bad-'));

    expect((await handleReadArchive(post({}), { home })).status).toBe(400);
    expect((await handleDeleteArchive(post({ id: '' }), { home })).status).toBe(400);
    expect((await handleCreateArchive(post({ note: 7 }), { home })).status).toBe(400);
    expect((await handleCreateArchive(post({ sessionKeys: [7] }), { home })).status).toBe(400);
    expect((await handleReadArchive(post('nonsense'), { home })).status).toBe(400);
    expect((await handleCreateArchive(post('nonsense'), { home })).status).toBe(400);
    expect((await handleDeleteArchive(post('nonsense'), { home })).status).toBe(400);
  });

  test('opens an archived transcript the agent no longer holds', { timeout: 30_000 }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'archive-api-read-'));
    const projectDir = join(home, '.claude', 'projects', 'proj');

    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 's.jsonl'), JSON.stringify({
      type: 'user',
      uuid: 'u1',
      timestamp: '2026-06-01T10:00:00Z',
      message: {
        role: 'user',
        content: 'archived question',
      },
    }), 'utf8');

    const created = await jsonOf(await handleCreateArchive(post({}), { home }));
    const id = archiveIdOf(created);
    const detail = await jsonOf(await handleReadArchive(post({ id }), { home }));
    const archivePath = archivedPathOf(detail);

    await rm(projectDir, { recursive: true });

    const page = await jsonOf(await handleLoadSession(post({
      filePath: archivePath,
      agent: 'claude',
    }), { home }));

    expect(page != null && isMessagesPageShape(page) ? page.entries : []).toHaveLength(1);
  });

  test('reports a deletion of something absent as a miss', { timeout: 20_000 }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'archive-api-missing-'));

    expect((await handleDeleteArchive(post({ id: 'absent' }), { home })).status).toBe(404);
  });
});

describe('retention endpoints', () => {
  test('reports due sessions, saves a policy and runs it', async () => {
    const home = await mkdtemp(join(tmpdir(), 'retention-api-home-'));
    const dir = await newDirWithSession();
    const deps = {
      claudeDir: dir,
      home,
    };

    const sessionPath = join(dir, 'projects', 'proj', 's.jsonl');

    await utimes(sessionPath, new Date('2026-06-01T00:00:00Z'), new Date('2026-06-01T00:00:00Z'));

    expect(await jsonOf(await handleRetentionStatus(deps))).toMatchObject({
      policy: { enabled: false },
      due: { sessions: [{ actualSessionId: 's' }] },
    });
    expect(await jsonOf(await handleWriteRetention(post({
      policy: {
        enabled: true,
        olderThanDays: 30,
        agents: ['claude'],
      },
    }), deps))).toMatchObject({ policy: { enabled: true } });
    expect(await jsonOf(await handleRunRetention(deps))).toMatchObject({
      result: { archived: 1 },
    });
  });

  test('rejects malformed retention policies', async () => {
    expect((await handleWriteRetention(post({}))).status).toBe(400);
    expect((await handleWriteRetention(post('nonsense'))).status).toBe(400);
    expect((await handleWriteRetention(post({
      policy: {
        enabled: true,
        olderThanDays: 0,
        agents: [],
      },
    }))).status).toBe(400);
  });
});
