import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  rm,
  stat,
  utimes,
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
  handleFileHistory,
  handleListArchives,
  handleListProjects,
  handleListSessions,
  handleLoadSession,
  handleNewestSessions,
  handlePluginAction,
  handlePluginCosts,
  handleProjectStats,
  handlePromptHistory,
  handleReadArchive,
  handleReadSettings,
  handleRecentEdits,
  handleReclaimStorage,
  handleRenameSession,
  handleRetentionStatus,
  handleRunRetention,
  handleSearch,
  handleStorageReport,
  handleUpdateCheck,
  handleWriteRetention,
  handleWriteSettings,
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
        {
          agent: 'gemini',
          mcpServers: [],
          rules: [],
        },
        {
          agent: 'antigravity',
          mcpServers: [],
          rules: [expect.objectContaining({
            path: join(project, 'AGENTS.md'),
            scope: 'project',
            bytes: 5,
          })],
        },
        {
          agent: 'cursor-agent',
          mcpServers: [],
          rules: [expect.objectContaining({
            path: join(project, 'AGENTS.md'),
            scope: 'project',
            bytes: 5,
          })],
        },
        {
          agent: 'grok',
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

describe('handlePluginAction', () => {
  test('rejects a body that names no runnable action', async () => {
    expect((await handlePluginAction(post('"not an object"'))).status).toBe(400);
    expect((await handlePluginAction(post({}))).status).toBe(400);
    expect((await handlePluginAction(post({
      projectPath: '/projects/demo',
      plugin: 'a@b',
      scope: 'user',
      action: 'uninstall',
    }))).status).toBe(400);
  });

  test('runs the requested action through the claude cli', async () => {
    const run = vi.fn(() => {
      return Promise.resolve({
        ok: true,
        output: 'done',
      });
    });

    const response = await handlePluginAction(post({
      projectPath: '/projects/demo',
      plugin: 'code-review@claude-plugins-official',
      scope: 'user',
      action: 'disable',
    }), {
      home: '/home/x',
      pluginAction: run,
    });

    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith([
      'plugin',
      'disable',
      'code-review@claude-plugins-official',
      '-s',
      'user',
    ], { cwd: '/home/x' });
  });

  test('reports a refused action with the cli output', async () => {
    const run = vi.fn(() => {
      return Promise.resolve({
        ok: false,
        output: 'not installed',
      });
    });

    const response = await handlePluginAction(post({
      projectPath: '/projects/demo',
      plugin: 'a@b',
      scope: 'project',
      action: 'enable',
    }), { pluginAction: run });

    expect(response.status).toBe(502);
    expect(await response.text()).toContain('not installed');
  });

  test('falls back to a message when a refused action printed nothing', async () => {
    const run = vi.fn(() => {
      return Promise.resolve({
        ok: false,
        output: '',
      });
    });

    const response = await handlePluginAction(post({
      projectPath: '/projects/demo',
      plugin: 'a@b',
      scope: 'user',
      action: 'install',
    }), { pluginAction: run });

    expect(response.status).toBe(502);
    expect(await response.text()).toContain('The Claude CLI rejected the plugin action.');
  });

  test('rejects a malformed action body', async () => {
    const run = vi.fn(() => {
      return Promise.resolve({
        ok: true,
        output: '',
      });
    });

    expect((await handlePluginAction(post({}))).status).toBe(400);
    expect((await handlePluginAction(post({
      action: 'enable',
      plugin: 'a b',
      scope: 'user',
      projectPath: '/p',
    }))).status).toBe(400);
    expect((await handlePluginAction(post({
      action: 'reinstall',
      plugin: 'a@b',
      scope: 'user',
      projectPath: '/p',
    }))).status).toBe(400);
    expect((await handlePluginAction(post({
      action: 'enable',
      plugin: 'a@b',
      scope: 'local',
      projectPath: '/p',
    }))).status).toBe(400);
    expect((await handlePluginAction(post({
      action: 'enable',
      plugin: 'a@b',
      scope: 'user',
      projectPath: '',
    }))).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('handlePluginCosts', () => {
  test('attributes projected context cost to enabled plugins', async () => {
    const project = await mkdtemp(join(tmpdir(), 'plugin-cost-'));
    const home = await mkdtemp(join(tmpdir(), 'plugin-cost-home-'));

    await mkdir(join(home, '.claude', 'plugins'), { recursive: true });
    await writeFile(join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'x@m': [{
          scope: 'user',
          version: '1',
        }],
      },
    }));
    await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify({
      enabledPlugins: {
        'x@m': true,
      },
    }));

    const run = vi.fn(() => {
      return Promise.resolve({
        ok: true,
        output: 'Always-on:   ~449 tok   added to every session',
      });
    });

    const response = await handlePluginCosts(post({ projectPath: project }), {
      home,
      pluginDetails: run,
    });
    const body = await jsonOf(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      costs: [{
        plugin: 'x@m',
        alwaysOnTokens: 449,
        onInvokeTokens: 0,
        estimatedCostUsd: 0,
      }],
    });
    expect(run).toHaveBeenCalledWith(['plugin', 'details', 'x@m'], { cwd: home });
  });

  test('rejects a request without a project path', async () => {
    expect((await handlePluginCosts(post({}))).status).toBe(400);
    expect((await handlePluginCosts(post({ projectPath: '' }))).status).toBe(400);
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

describe('settings endpoints', () => {
  const emptyPatch = {
    permissions: {
      allow: [],
      deny: [],
      ask: [],
      additionalDirectories: [],
    },
    env: [],
  };

  test('reads every scope and writes one back', async () => {
    const home = await mkdtemp(join(tmpdir(), 'settings-api-home-'));
    const project = await mkdtemp(join(tmpdir(), 'settings-api-project-'));

    expect(await jsonOf(await handleReadSettings(post({ projectPath: project }), { home })))
      .toMatchObject({ scopes: [{ scope: 'user' }, { scope: 'project' }, { scope: 'local' }] });

    const written = await handleWriteSettings(post({
      projectPath: project,
      scope: 'project',
      patch: {
        ...emptyPatch,
        permissions: {
          ...emptyPatch.permissions,
          allow: ['Bash(ls:*)'],
        },
        env: [{
          name: 'A',
          value: 'b',
        }],
      },
    }), { home });

    expect(written.status).toBe(200);
    expect(await jsonOf(written)).toMatchObject({
      scope: {
        scope: 'project',
        exists: true,
        permissions: { allow: ['Bash(ls:*)'] },
      },
    });
  });

  test('rejects malformed settings requests', async () => {
    const home = await mkdtemp(join(tmpdir(), 'settings-api-bad-'));

    expect((await handleReadSettings(post({}), { home })).status).toBe(400);
    expect((await handleReadSettings(post('nonsense'), { home })).status).toBe(400);
    expect((await handleWriteSettings(post('nonsense'), { home })).status).toBe(400);
    expect((await handleWriteSettings(post({
      projectPath: '/repo',
      scope: 'global',
      patch: emptyPatch,
    }), { home })).status).toBe(400);
    expect((await handleWriteSettings(post({
      projectPath: '/repo',
      scope: 'user',
      patch: { env: [] },
    }), { home })).status).toBe(400);
    expect((await handleWriteSettings(post({
      projectPath: '/repo',
      scope: 'user',
      patch: {
        permissions: {
          allow: [7],
          deny: [],
          ask: [],
          additionalDirectories: [],
        },
        env: [],
      },
    }), { home })).status).toBe(400);
    expect((await handleWriteSettings(post({
      projectPath: '/repo',
      scope: 'user',
      patch: {
        ...emptyPatch,
        env: [{ name: 'A' }],
      },
    }), { home })).status).toBe(400);
    expect((await handleWriteSettings(post({
      projectPath: '/repo',
      scope: 'user',
      patch: 'nope',
    }), { home })).status).toBe(400);
  });

  test('refuses a project write that names no project', async () => {
    const home = await mkdtemp(join(tmpdir(), 'settings-api-noproject-'));

    expect((await handleWriteSettings(post({
      projectPath: '',
      scope: 'project',
      patch: emptyPatch,
    }), { home })).status).toBe(400);
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

describe('newest sessions endpoint', () => {
  test('gathers the newest sessions across every project', async () => {
    const home = await mkdtemp(join(tmpdir(), 'newest-api-'));
    const projectDir = join(home, '.claude', 'projects', 'proj');

    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, 's.jsonl'), JSON.stringify({
      type: 'user',
      uuid: 'u',
      timestamp: '2026-01-01T00:00:00Z',
      message: {
        role: 'user',
        content: 'Hi',
      },
    }), 'utf8');

    const response = await handleNewestSessions(post({}), { home });

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({ sessions: [{ projectId: 'proj' }] });
  });
});

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

describe('prompt history endpoint', () => {
  test('reports the prompts the agent recorded', async () => {
    const home = await mkdtemp(join(tmpdir(), 'prompts-api-'));

    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(join(home, '.claude', 'history.jsonl'), `${JSON.stringify({
      display: 'find the needle',
      project: '/repo/alpha',
      sessionId: 's1',
      timestamp: 1_000,
    })}\n`, 'utf8');

    const response = await handlePromptHistory({ home });

    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toMatchObject({
      total: 1,
      prompts: [{ text: 'find the needle' }],
    });
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
