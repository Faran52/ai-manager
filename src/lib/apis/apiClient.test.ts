import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import {
  createArchive,
  deleteArchive,
  deleteProject,
  deleteSession,
  fetchArchive,
  fetchArchives,
  fetchMessages,
  fetchProjects,
  fetchSearch,
  fetchSessions,
  fetchStats,
  renameSession,
} from './apiClient';

import type { SessionMutationBody } from './contracts';

const jsonResponse = (body: object, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('session mutations', () => {
  test('validates rename and delete acknowledgements', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return jsonResponse({ ok: true });
    }));
    const target: SessionMutationBody = {
      agent: 'claude',
      filePath: '/f.jsonl',
      actualSessionId: 's',
    };

    await expect(renameSession({
      ...target,
      title: 'New',
    })).resolves.toEqual({ ok: true });
    await expect(deleteSession(target)).resolves.toEqual({ ok: true });
    await expect(deleteProject({
      agent: 'claude',
      projectId: 'p',
    })).resolves.toEqual({ ok: true });
  });

  test('rejects invalid mutation acknowledgements', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return jsonResponse({ ok: false });
    }));

    await expect(deleteSession({
      agent: 'codex',
      filePath: '/f.jsonl',
      actualSessionId: 's',
    })).rejects.toThrow('unexpected shape');
  });
});

describe('fetchProjects', () => {
  test('returns validated project payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return jsonResponse({
          projects: [{
            id: 'p1',
            name: 'p1',
          }],
        });
      }),
    );

    const { projects } = await fetchProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ id: 'p1' });
  });

  test('surfaces server error messages', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return jsonResponse({ error: 'scan failed' }, 500);
    }));

    await expect(fetchProjects()).rejects.toThrow('scan failed');
  });

  test('falls back to a status-based message for non-JSON errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return new Response('<html>boom</html>', { status: 502 });
      }),
    );

    await expect(fetchProjects()).rejects.toThrow('project list failed (502)');
  });

  test('reports network failures as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new TypeError('connection refused');
    }));

    await expect(fetchProjects()).rejects.toThrow('project list unreachable');
  });

  test('rejects payloads with an unexpected shape', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return jsonResponse({ nope: true });
    }));

    await expect(fetchProjects()).rejects.toThrow('unexpected shape');
  });
});

describe('fetchSessions', () => {
  test('validates the sessions array', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return jsonResponse({ sessions: [] });
    }));

    await expect(fetchSessions({
      projectId: 'p',
      agent: 'claude',
    })).resolves.toEqual({ sessions: [] });
  });
});

describe('fetchMessages', () => {
  test('accepts a page payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        return jsonResponse({
          entries: [{
            kind: 'summary',
            text: 'x',
          }],
          total: 1,
          hasMore: false,
          nextOffset: 1,
        });
      },
      ),
    );

    const page = await fetchMessages({
      filePath: '/f.jsonl',
      agent: 'claude',
      offset: 0,
      limit: 10,
    });

    expect(page.total).toBe(1);
  });

  test('rejects pages missing totals', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return jsonResponse({ entries: [] });
    }));

    await expect(fetchMessages({
      filePath: '/f.jsonl',
      agent: 'claude',
      offset: 0,
      limit: 10,
    })).rejects.toThrow(
      'session messages returned an unexpected shape',
    );
  });
});

describe('fetchSearch and fetchStats', () => {
  test('validates search outcomes', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return jsonResponse({
        hits: [],
        truncated: false,
      });
    }));

    await expect(fetchSearch({ query: 'q' })).resolves.toMatchObject({ truncated: false });
  });

  test('passes stats through untouched when absent', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return jsonResponse({ stats: null });
    }));

    await expect(fetchStats({
      projectId: 'ghost',
      agent: 'claude',
    })).resolves.toEqual({ stats: null });
  });
});

describe('unreadable bodies', () => {
  test('rejects when the response body cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return {
        ok: true,
        status: 200,
        text: () => {
          throw new Error('stream broken');
        },
      };
    }));

    await expect(fetchProjects()).rejects.toThrow('project list returned an unreadable body');
  });
});

describe('error json without an error field', () => {
  test('falls back to the status message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"foo":1}', { status: 503 });
    }));

    await expect(fetchProjects()).rejects.toThrow('project list failed (503)');
  });
});

describe('malformed success bodies', () => {
  test('rejects 200 responses with broken JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"projects":', { status: 200 });
    }));

    await expect(fetchProjects()).rejects.toThrow('project list returned malformed JSON');
  });
});

describe('archive endpoints', () => {
  const summary = {
    id: '2026-07-01T00-00-00-000Z',
    createdMs: 1,
    note: '',
    sessionCount: 2,
    sizeBytes: 40,
    agents: ['claude'],
  };

  test('reads the list, one archive and an acknowledged delete', async () => {
    vi.stubGlobal('fetch', vi.fn((path: string) => {
      if (path.endsWith('/archives')) {
        return jsonResponse({ archives: [summary] });
      }
      if (path.endsWith('/archive-read')) {
        return jsonResponse({
          archive: {
            ...summary,
            sessions: [],
          },
        });
      }

      return jsonResponse({ ok: true });
    }));

    await expect(fetchArchives()).resolves.toEqual({ archives: [summary] });
    await expect(fetchArchive({ id: summary.id })).resolves.toMatchObject({ archive: { id: summary.id } });
    await expect(deleteArchive({ id: summary.id })).resolves.toEqual({ ok: true });
  });

  test('returns the archive a create call reports', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return jsonResponse({ archive: summary });
    }));

    await expect(createArchive({ note: 'before upgrade' })).resolves.toEqual({ archive: summary });
  });

  test('rejects archive responses of the wrong shape', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return jsonResponse({ archives: 'many' });
    }));

    await expect(fetchArchives()).rejects.toThrow('unexpected shape');

    vi.stubGlobal('fetch', vi.fn(() => {
      return jsonResponse({ archive: null });
    }));

    await expect(createArchive({})).rejects.toThrow('unexpected shape');
  });
});
