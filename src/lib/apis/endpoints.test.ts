import {
  mkdir,
  mkdtemp,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import {
  handleAgentSetup,
  handleCreateArchive,
  handleDeleteArchive,
  handleDeleteProject,
  handleDeleteSession,
  handleListArchives,
  handleListProjects,
  handleListSessions,
  handleLoadSession,
  handleProjectStats,
  handleReadArchive,
  handleRenameSession,
  handleSearch,
  handleUpdateCheck,
  parseLoadSessionBody,
  resolveEndpointRoots,
} from './endpoints';

import type { RawHistoryLine } from '@services/history/historyService';
import type {
  ArchiveDetailResponse,
  CreateArchiveResponse,
  MessagesResponse,
} from './contracts';

beforeEach(() => {
  vi.stubEnv('XDG_DATA_HOME', tmpdir());
  vi.stubEnv('XDG_CONFIG_HOME', tmpdir());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const post = (body: object | string): Request => {
  return new Request('https://localhost/api/x', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
};

const newDirWithSession = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'api-'));
  const projectDir = join(dir, 'projects', 'proj');

  await mkdir(projectDir, { recursive: true });
  const lines: readonly RawHistoryLine[] = [
    {
      type: 'user',
      uuid: 'u1',
      timestamp: '2026-06-01T10:00:00Z',
      message: {
        role: 'user',
        content: 'find the needle',
      },
    },
    {
      type: 'assistant',
      uuid: 'a1',
      timestamp: '2026-06-01T10:00:10Z',
      message: {
        role: 'assistant',
        model: 'm1',
        usage: {
          input_tokens: 3,
          output_tokens: 4,
        },
        content: [{
          type: 'text',
          text: 'done',
        }],
      },
    },
  ];

  await writeFile(join(projectDir, 's.jsonl'), lines.map((line) => {
    return JSON.stringify(line);
  }).join('\n'), 'utf8');

  return dir;
};

const isObjectLike = (value: unknown): value is object => {
  return typeof value === 'object' && value !== null;
};

const isMessagesPageShape = (value: object): value is MessagesResponse => {
  return 'entries' in value && 'total' in value && Array.isArray(value.entries);
};

const jsonOf = async (response: Response): Promise<object | undefined> => {
  const parsed: unknown = JSON.parse(await response.text());

  return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
};

test('resolves default and overridden endpoint agent roots', () => {
  const defaults = resolveEndpointRoots(undefined);

  expect(defaults.claude.length).toBeGreaterThan(0);
  expect(resolveEndpointRoots({
    claudeDir: '/c',
    codexDir: '/x',
  }).claude).toEqual(['/c']);
  expect(resolveEndpointRoots({
    claudeDir: '/c',
    codexDir: '/x',
  }).codex).toEqual(['/x']);
});

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

describe('handleProjectStats', () => {
  test('returns undefined stats for an empty project', async () => {
    const dir = await newDirWithSession();
    const response = await handleProjectStats(
      post({
        projectId: 'ghost',
        agent: 'claude',
      }),
      {
        claudeDir: dir,
        codexDir: dir,
      },
    );

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual({ stats: null });
  });

  test('aggregates stats for a real project', async () => {
    const dir = await newDirWithSession();
    const response = await handleProjectStats(
      post({
        projectId: 'proj',
        agent: 'claude',
      }),
      {
        claudeDir: dir,
        codexDir: dir,
      },
    );

    const body = await jsonOf(response);

    expect(JSON.stringify(body)).toContain('"inputTokens":3');
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

describe('stats validation', () => {
  test('rejects stats requests without a projectId', async () => {
    expect((await handleProjectStats(post({}))).status).toBe(400);
  });

  test('returns empty stats when a agent has no configured test path', async () => {
    const response = await handleProjectStats(post({
      projectId: 'p',
      agent: 'continue',
    }), {
      claudeDir: '/missing',
      codexDir: '/missing',
    });

    expect(await jsonOf(response)).toEqual({ stats: null });
  });

  test('routes Codex stats through the Codex history root', async () => {
    const response = await handleProjectStats(post({
      projectId: 'p',
      agent: 'codex',
    }), {
      claudeDir: '/missing-claude',
      codexDir: '/missing-codex',
    });

    expect(await jsonOf(response)).toEqual({ stats: null });
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

describe('handleAgentSetup', () => {
  test('reports every managed agent for a project', async () => {
    const project = await mkdtemp(join(tmpdir(), 'setup-endpoint-'));
    const home = await mkdtemp(join(tmpdir(), 'setup-home-'));

    await writeFile(join(project, 'AGENTS.md'), 'rules');

    const response = await handleAgentSetup(post({ projectPath: project }), { home });
    const body = await jsonOf(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      setups: [
        {
          agent: 'claude',
          mcpServers: [],
          rules: [],
        },
        {
          agent: 'codex',
          mcpServers: [],
          rules: [expect.objectContaining({
            path: join(project, 'AGENTS.md'),
            scope: 'project',
            bytes: 5,
          })],
        },
        {
          agent: 'gemini',
          mcpServers: [],
          rules: [],
        },
        {
          agent: 'copilot',
          mcpServers: [],
          rules: [],
        },
        {
          agent: 'cursor',
          mcpServers: [],
          rules: [expect.objectContaining({
            path: join(project, 'AGENTS.md'),
            scope: 'project',
            bytes: 5,
          })],
        },
        {
          agent: 'opencode',
          mcpServers: [],
          rules: [expect.objectContaining({
            path: join(project, 'AGENTS.md'),
            scope: 'project',
            bytes: 5,
          })],
        },
      ],
    });
  });

  test('rejects a request without a project path', async () => {
    expect((await handleAgentSetup(post({}))).status).toBe(400);
    expect((await handleAgentSetup(post({ projectPath: '' }))).status).toBe(400);
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

describe('handleUpdateCheck', () => {
  test('reports unsupported when no release feed is configured', async () => {
    const response = await handleUpdateCheck({ config: undefined });

    expect(await jsonOf(response)).toEqual({ update: { stage: 'unsupported' } });
  });

  test('passes a configured feed through to the checker', async () => {
    const response = await handleUpdateCheck({
      config: {
        baseUrl: 'https://releases.example.com/app',
        currentVersion: '1.0.0',
      },
      updateDeps: {
        platform: 'darwin',
        fetch: () => {
          return Promise.resolve({
            ok: true,
            text: () => {
              return Promise.resolve(JSON.stringify({
                version: '2.0.0',
                artifacts: {
                  darwin: {
                    name: 'app-2.0.0.zip',
                    sha256: 'a'.repeat(64),
                  },
                },
              }));
            },
          } as Response);
        },
      },
    });

    expect(await jsonOf(response)).toMatchObject({
      update: {
        stage: 'available',
        version: '2.0.0',
      },
    });
  });
});

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

  test('rejects malformed archive requests', async () => {
    const home = await mkdtemp(join(tmpdir(), 'archive-api-bad-'));

    expect((await handleReadArchive(post({}), { home })).status).toBe(400);
    expect((await handleDeleteArchive(post({ id: '' }), { home })).status).toBe(400);
    expect((await handleCreateArchive(post({ note: 7 }), { home })).status).toBe(400);
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

  test('reports a failed deletion as an error', { timeout: 20_000 }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'archive-api-missing-'));

    expect((await handleDeleteArchive(post({ id: 'absent' }), { home })).status).toBe(500);
  });
});
