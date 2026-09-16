import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import {
  isMessagesPageShape,
  isObjectLike,
  jsonOf,
  newDirWithSession,
  post,
  stubAgentEnv,
} from '@mocks/endpointRequestFixtures';

import {
  handleDeleteProject,
  handleDeleteSession,
  handleFileHistory,
  handleListProjects,
  handleListSessions,
  handleLoadSession,
  handleRecentEdits,
  handleRenameSession,
  handleSearch,
  parseLoadSessionBody,
} from './sessionEndpointUtils';

stubAgentEnv();

describe('handleListProjects', () => {
  test('returns the scanned projects', { timeout: 20_000 }, async () => {
    const dir = await newDirWithSession();
    const response = await handleListProjects({
      claudeDir: dir,
      codexDir: dir,
      home: dir,
    });

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({
      projects: [{
        id: 'proj',
        name: 'proj',
        sessionCount: 1,
      }],
    });
  });
});

describe('session mutation endpoints', () => {
  test('renames and deletes validated Claude history', async () => {
    const dir = await newDirWithSession();
    const filePath = join(dir, 'projects', 'proj', 's.jsonl');
    const deps = {
      claudeDir: dir,
      codexDir: dir,
    };
    const target = {
      agent: 'claude',
      filePath,
      actualSessionId: 's',
    };

    expect((await handleRenameSession(post({
      ...target,
      title: 'Native title',
    }), deps)).status).toBe(200);
    expect((await handleDeleteSession(post(target), deps)).status).toBe(200);
    expect((await handleDeleteProject(post({
      agent: 'claude',
      projectId: 'proj',
    }), deps)).status).toBe(200);
    await expect(stat(filePath)).rejects.toThrow();
  });

  test('rejects malformed mutation targets and titles', async () => {
    expect((await handleDeleteSession(post(''))).status).toBe(400);
    expect((await handleDeleteSession(post({}))).status).toBe(400);
    expect((await handleDeleteSession(post({
      agent: 'other',
      filePath: '/x',
      actualSessionId: 's',
    }))).status)
      .toBe(400);
    expect((await handleDeleteSession(post({
      agent: 'claude',
      filePath: '',
      actualSessionId: 's',
    }))).status)
      .toBe(400);
    expect((await handleDeleteSession(post({
      agent: 'claude',
      filePath: '/x',
      actualSessionId: '',
    }))).status)
      .toBe(400);
    expect((await handleRenameSession(post({
      agent: 'claude',
      filePath: '/x',
      actualSessionId: 's',
      title: 1,
    }))).status).toBe(400);
    expect((await handleRenameSession(post(''))).status).toBe(400);
    expect((await handleDeleteProject(post({}))).status).toBe(400);
    expect((await handleDeleteProject(post(''))).status).toBe(400);
  });
});

describe('handleListSessions', () => {
  test('rejects bodies without a usable projectId', async () => {
    const response = await handleListSessions(post({}));

    expect(response.status).toBe(400);
  });

  test('rejects malformed JSON bodies', async () => {
    const response = await handleListSessions(post('{oops'));

    expect(response.status).toBe(400);
  });

  test('returns sessions for the requested project', async () => {
    const dir = await newDirWithSession();
    const response = await handleListSessions(
      post({
        projectId: 'proj',
        agent: 'claude',
      }),
      {
        claudeDir: dir,
        codexDir: dir,
      },
    );

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({
      sessions: [{
        id: 's',
        messageCount: 2,
      }],
    });
  });
});

describe('handleLoadSession', () => {
  test('parses agent-aware optional paging fields', () => {
    expect(parseLoadSessionBody({ filePath: '/x.jsonl' })).toBeUndefined();
    expect(parseLoadSessionBody({
      filePath: '/x.jsonl',
      agent: 'claude',
      offset: 'x',
      limit: 'x',
      includeSidechain: false,
    })).toEqual({
      filePath: '/x.jsonl',
      agent: 'claude',
      offset: undefined,
      limit: undefined,
      includeSidechain: false,
    });
  });

  test('requires a filePath', async () => {
    expect((await handleLoadSession(post({}))).status).toBe(400);
    expect((await handleLoadSession(post({ filePath: '' }))).status).toBe(400);
  });

  test('reports missing session files as 404', async () => {
    const response = await handleLoadSession(post({
      filePath: '/nowhere/s.jsonl',
      agent: 'claude',
    }));

    expect(response.status).toBe(404);
  });

  test('paginates and clamps the requested page size', async () => {
    const dir = await newDirWithSession();
    const filePath = join(dir, 'projects', 'proj', 's.jsonl');
    const response = await handleLoadSession(
      post({
        filePath,
        agent: 'claude',
        offset: 0,
        limit: 99_999,
      }),
      { claudeDir: dir },
    );

    const parsed: unknown = JSON.parse(await response.text());

    if (!isObjectLike(parsed) || !isMessagesPageShape(parsed)) {
      throw new Error('response was not a session page');
    }

    expect(parsed).toMatchObject({
      total: 2,
      hasMore: false,
      nextOffset: 2,
    });
    expect(parsed.entries).toHaveLength(2);
  });
});

describe('handleSearch', () => {
  test('requires a query field', async () => {
    expect((await handleSearch(post({}))).status).toBe(400);
    expect((await handleSearch(post({ query: 5 }))).status).toBe(400);
  });

  test('searches within the resolved history directory', { timeout: 20_000 }, async () => {
    const dir = await newDirWithSession();
    const response = await handleSearch(post({ query: 'needle' }), {
      claudeDir: dir,
      codexDir: dir,
    });

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({ truncated: false });
  });
});

describe('handler fallbacks', () => {
  test('list projects resolves the real claude dir when deps are omitted', async () => {
    vi.stubEnv('HOME', await mkdtemp(join(tmpdir(), 'api-home-')));
    const response = await handleListProjects({});

    expect(response.status).toBe(200);
  });

  test('load session clamps tiny and huge page sizes', async () => {
    const dir = await newDirWithSession();
    const filePath = join(dir, 'projects', 'proj', 's.jsonl');

    const tiny = await handleLoadSession(post({
      filePath,
      agent: 'claude',
      limit: 0,
    }), { claudeDir: dir });
    const body = await jsonOf(tiny);

    expect(body).toMatchObject({ total: 2 });

    const offsetBack = await handleLoadSession(post({
      filePath,
      agent: 'claude',
      offset: -9,
    }), { claudeDir: dir });

    expect(offsetBack.status).toBe(200);
  });
});

describe('load session body variants', () => {
  test('accepts explicit sidechain inclusion', async () => {
    const dir = await newDirWithSession();
    const filePath = join(dir, 'projects', 'proj', 's.jsonl');
    const response = await handleLoadSession(post({
      filePath,
      agent: 'claude',
      offset: -4,
      limit: 1.9,
      includeSidechain: true,
    }), { claudeDir: dir });
    const body = await jsonOf(response);

    expect(body).toMatchObject({ total: 2 });
  });
});

describe('search and load body guards', () => {
  test('rejects non-string projectId on search', async () => {
    expect((await handleSearch(post({
      query: 'q',
      projectId: 7,
    }))).status).toBe(400);
  });

  test('treats an empty request body as a bad load-session request', async () => {
    expect((await handleLoadSession(post(''))).status).toBe(400);
  });
});

describe('read-path containment', () => {
  test('refuses session files outside the agent root even when they exist', async () => {
    const dir = await newDirWithSession();
    const outside = await newDirWithSession();
    const outsideFile = join(outside, 'projects', 'proj', 's.jsonl');
    const response = await handleLoadSession(
      post({
        filePath: outsideFile,
        agent: 'claude',
      }),
      { claudeDir: dir },
    );

    expect(response.status).toBe(404);
  });

  test('refuses project ids that traverse directories', async () => {
    const dir = await newDirWithSession();
    const response = await handleListSessions(post({
      projectId: '../other',
      agent: 'claude',
    }), {
      claudeDir: dir,
    });

    expect(await jsonOf(response)).toEqual({ sessions: [] });
  });
});

describe('recent edits endpoint', () => {
  test('lists the files a project changed', { timeout: 30_000 }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'edits-api-'));
    const projectDir = join(home, '.claude', 'projects', 'proj');

    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 's.jsonl'), JSON.stringify({
      type: 'assistant',
      uuid: 'a1',
      timestamp: '2026-06-01T10:00:00Z',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 't1',
          name: 'Edit',
          input: {
            file_path: '/repo/a.ts',
            old_string: 'x',
            new_string: 'y',
          },
        }],
      },
    }), 'utf8');

    const response = await handleRecentEdits(post({
      agent: 'claude',
      projectId: 'proj',
    }), { home });

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({
      files: [{
        path: '/repo/a.ts',
        edits: 1,
      }],
    });
  });

  test('answers for the whole machine when no project is named', async () => {
    const home = await mkdtemp(join(tmpdir(), 'edits-api-'));
    const response = await handleRecentEdits(post({}), { home });

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({ files: [] });
  });

  test('rejects a request it cannot make sense of', async () => {
    expect((await handleRecentEdits(post({ projectId: 4 }))).status).toBe(400);
    expect((await handleRecentEdits(post({ agent: 'nope' }))).status).toBe(400);
    expect((await handleRecentEdits(post('nonsense'))).status).toBe(400);
  });
});

describe('file history endpoint', () => {
  const SESSION = 'session-9';
  const TRACKED = '/repo/a.ts';

  const newSnapshotHome = async (): Promise<string> => {
    const home = await mkdtemp(join(tmpdir(), 'file-history-api-'));
    const dir = join(home, '.claude', 'file-history', SESSION);
    const key = createHash('sha256').update(TRACKED).digest('hex').slice(0, 16);

    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${key}@v1`), 'one\ntwo', 'utf8');
    await writeFile(join(dir, `${key}@v2`), 'one\nTWO', 'utf8');

    return home;
  };

  test('compares the newest version when no version is asked for', async () => {
    const home = await newSnapshotHome();
    const response = await handleFileHistory(post({
      sessionId: SESSION,
      path: TRACKED,
    }), { home });

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({
      history: { versions: [{ version: 1 }, { version: 2 }] },
      diff: {
        version: 2,
        firstRecorded: false,
      },
    });
  });

  test('compares the version that was asked for', async () => {
    const home = await newSnapshotHome();
    const response = await handleFileHistory(post({
      sessionId: SESSION,
      path: TRACKED,
      version: 1,
    }), { home });

    expect(await jsonOf(response)).toMatchObject({ diff: { firstRecorded: true } });
  });

  test('reports no comparison for a file that was never kept', async () => {
    const home = await mkdtemp(join(tmpdir(), 'file-history-api-'));
    const response = await handleFileHistory(post({
      sessionId: SESSION,
      path: TRACKED,
    }), { home });

    expect(await jsonOf(response)).toMatchObject({
      history: { versions: [] },
      diff: null,
    });
  });

  test('reports no comparison for a version that was never kept', async () => {
    const home = await newSnapshotHome();
    const response = await handleFileHistory(post({
      sessionId: SESSION,
      path: TRACKED,
      version: 7,
    }), { home });

    expect(await jsonOf(response)).toMatchObject({ diff: null });
  });

  test('rejects a request without a session and a path', async () => {
    expect((await handleFileHistory(post({}))).status).toBe(400);
    expect((await handleFileHistory(post({
      sessionId: SESSION,
      path: TRACKED,
      version: 'two',
    }))).status).toBe(400);
    expect((await handleFileHistory(post({ sessionId: SESSION }))).status).toBe(400);
    expect((await handleFileHistory(post('nonsense'))).status).toBe(400);
  });
});
