import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { findAgentProject } from '@services/history/historyService';

import { HistoryApp } from './HistoryApp';

import type { ProjectSummary } from '@services/history/historyService';

interface ProjectPayload {
  readonly projects: readonly ProjectSummary[];
}

const toPath = (url: RequestInfo | URL): string => {
  if (typeof url === 'string') {
    return url;
  }

  return url instanceof URL ? url.href : url.url;
};

const projectPayload: ProjectPayload = {
  projects: [
    {
      agent: 'claude',
      id: 'proj-a',
      name: 'alpha',
      actualPath: '/repo/alpha',
      sessionCount: 1,
      messageCount: 2,
      lastActivityMs: Date.UTC(2026, 0, 1),
    },
    {
      agent: 'claude',
      id: 'proj-b',
      name: 'beta',
      sessionCount: 1,
      messageCount: 1,
      lastActivityMs: Date.UTC(2026, 0, 2),
    },
  ],
};

const sessionsPayload = (name: string) => {
  return {
    sessions: [
      {
        agent: 'claude',
        actualSessionId: 's1',
        id: 's1',
        filePath: `/r/${name}/s1.jsonl`,
        projectId: `proj-${name}`,
        title: 'The chosen one',
        summary: undefined,
        preview: 'first question',
        messageCount: 2,
        firstTimestampMs: Date.UTC(2026, 0, 1),
        lastTimestampMs: Date.UTC(2026, 0, 1, 5),
        modifiedMs: 0,
        sizeBytes: 10,
      },
    ],
  };
};

const messagesPayload = {
  entries: [
    {
      kind: 'user',
      uuid: 'u1',
      timestamp: '2026-01-01T00:00:00.000Z',
      sidechain: false,
      meta: false,
      text: 'the question',
      outcomes: [],
    },
    {
      kind: 'assistant',
      uuid: 'a1',
      timestamp: '2026-01-01T00:00:05.000Z',
      sidechain: false,
      model: 'm',
      blocks: [{
        blockType: 'text',
        text: 'the answer',
      }],
    },
  ],
  messageCount: 2,
  total: 2,
  hasMore: false,
  nextOffset: 2,
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('HistoryApp', () => {
  test('browses project → session → viewer end to end', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const path = toPath(url);

      if (path.endsWith('/projects')) {
        return Response.json(projectPayload);
      }
      if (path.endsWith('/sessions')) {
        return Response.json(sessionsPayload('a'));
      }
      if (path.endsWith('/messages')) {
        return Response.json(messagesPayload);
      }
      if (path.endsWith('/search')) {
        return Response.json({
          hits: [],
          truncated: false,
        });
      }
      return Response.json({ stats: null });
    });

    vi.stubGlobal('fetch', fetchMock);
    render(<HistoryApp />);

    await waitFor(() => {
      expect(screen.getByText('alpha')).toBeDefined();
    });
    expect(screen.getAllByRole('button', { name: /beta/ }).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByText('alpha'));
    const target = screen.getAllByText('The chosen one').at(0);

    if (target != null) {
      await userEvent.click(target);
    }

    expect(await screen.findByText('the question')).toBeDefined();
    expect(await screen.findByText('the answer')).toBeDefined();
    expect(fetchMock.mock.calls.some(([url]) => {
      return toPath(url).endsWith('/messages');
    })).toBe(true);
  });

  test('opens search with the slash key and switches to analytics', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const path = toPath(url);

      if (path.endsWith('/projects')) {
        return Response.json(projectPayload);
      }
      if (path.endsWith('/stats')) {
        return Response.json({ stats: null });
      }
      return Response.json({
        sessions: [],
        hits: [],
        truncated: false,
      });
    });

    vi.stubGlobal('fetch', fetchMock);
    render(<HistoryApp />);

    await screen.findByText('alpha');

    await userEvent.keyboard('/');
    expect(screen.getByLabelText('Search history')).toBeDefined();

    await userEvent.keyboard('/');
    expect(screen.getByLabelText('Search history')).toBeDefined();

    fireEvent(window, new KeyboardEvent('keydown', { key: '/' }));
    expect(screen.getByLabelText('Search history')).toBeDefined();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByLabelText('Search history')).toBeNull();
    });

    await userEvent.click(screen.getByRole('button', { name: /Analytics/ }));

    expect(await screen.findByText(/No analytics for/)).toBeDefined();
  });

  test('asks for a project before reading health', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      return toPath(url).endsWith('/projects')
        ? Response.json(projectPayload)
        : Response.json({
            sessions: [],
            hits: [],
            truncated: false,
          });
    });

    vi.stubGlobal('fetch', fetchMock);
    render(<HistoryApp />);
    await screen.findByText('alpha');

    await userEvent.click(screen.getByRole('button', { name: /Health/ }));

    expect(await screen.findByText('No project selected')).toBeDefined();
    expect(fetchMock.mock.calls.some(([url]) => {
      return toPath(url).endsWith('/agent-setup');
    })).toBe(false);
  });

  test('shows agent health for the selected project', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const path = toPath(url);

      if (path.endsWith('/projects')) {
        return Response.json(projectPayload);
      }
      if (path.endsWith('/agent-setup')) {
        return Response.json({
          setups: [
            {
              agent: 'claude',
              mcpServers: [{
                name: 'context7',
                scope: 'user',
                source: '/home/.claude.json',
                command: null,
              }],
              rules: [],
            },
          ],
        });
      }
      return Response.json({
        sessions: [],
        hits: [],
        truncated: false,
      });
    });

    vi.stubGlobal('fetch', fetchMock);
    render(<HistoryApp />);
    await userEvent.click(await screen.findByText('alpha'));

    await userEvent.click(screen.getByRole('button', { name: /Health/ }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => {
        return toPath(url).endsWith('/agent-setup');
      })).toBe(true);
    });

    expect(await screen.findByText('context7')).toBeDefined();
  });
});

describe('HistoryApp cross-view flows', () => {
  test('jumps from analytics top sessions into the viewer', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const path = toPath(url);

      if (path.endsWith('/projects')) {
        return Response.json(projectPayload);
      }
      if (path.endsWith('/stats')) {
        return Response.json({
          stats: {
            projectId: 'proj-b',
            totals: {
              sessions: 1,
              messages: 1,
              inputTokens: 0,
              outputTokens: 0,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              costUsd: 0,
              durationMs: 0,
            },
            models: [],
            tools: [],
            activity: [],
            topSessions: [{
              filePath: '/r/b/s9.jsonl',
              sessionId: 's9',
              title: 'Beta hit',
              tokens: 5,
              messages: 1,
              lastTimestampMs: Date.UTC(2026, 0, 2),
            }],
          },
        });
      }
      if (path.endsWith('/sessions')) {
        return Response.json(sessionsPayload('b'));
      }
      if (path.endsWith('/messages')) {
        return Response.json(messagesPayload);
      }
      return Response.json({
        hits: [],
        truncated: false,
      });
    });

    vi.stubGlobal('fetch', fetchMock);
    render(<HistoryApp />);

    await screen.findByText('beta');
    await userEvent.click(screen.getByText('beta'));
    await userEvent.click(screen.getByRole('button', { name: /Analytics/ }));

    const betaHit = await screen.findByText('Beta hit');

    await userEvent.click(betaHit);

    expect(await screen.findByText('the question')).toBeDefined();
  });

  test('sets the chosen theme in one step and persists it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: RequestInfo | URL) => {
        return toPath(url).endsWith('/projects') ? Response.json(projectPayload) : Response.json({ sessions: [] });
      },
      ),
    );
    render(<HistoryApp />);
    await screen.findByText('alpha');

    await userEvent.click(screen.getByTitle('Theme: Match system'));
    await userEvent.click(screen.getByText('Dark'));

    expect(localStorage.getItem('acm-theme')).toBe('dark');

    await userEvent.click(screen.getByTitle('Theme: Dark'));
    await userEvent.click(screen.getByText('Light'));

    expect(localStorage.getItem('acm-theme')).toBe('light');
  });

  test('does not hijack slash while typing in a filter field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: RequestInfo | URL) => {
        return toPath(url).endsWith('/projects') ? Response.json(projectPayload) : Response.json({ sessions: [] });
      },
      ),
    );
    render(<HistoryApp />);
    await screen.findByText('alpha');

    await userEvent.type(screen.getByLabelText('Filter projects'), '/');

    expect(screen.queryByLabelText('Search history')).toBeNull();
  });
});

describe('HistoryApp search jump flow', () => {
  test('jumps from a search hit straight into the session', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const path = toPath(url);

      if (path.endsWith('/projects')) {
        return Response.json(projectPayload);
      }
      if (path.endsWith('/search')) {
        return Response.json({
          hits: [
            {
              filePath: '/r/a/s1.jsonl',
              projectId: 'proj-a',
              sessionId: 's1',
              role: 'user',
              timestampMs: Date.UTC(2026, 0, 1, 5),
              before: 'the ',
              match: 'question',
              after: '',
            },
          ],
          truncated: false,
        });
      }
      if (path.endsWith('/sessions')) {
        return Response.json(sessionsPayload('a'));
      }
      if (path.endsWith('/messages')) {
        return Response.json(messagesPayload);
      }
      return Response.json({ stats: null });
    });

    vi.stubGlobal('fetch', fetchMock);
    render(<HistoryApp />);

    await screen.findByText('alpha');
    await userEvent.click(screen.getByTitle('Search all chats (press /)'));
    await userEvent.type(screen.getByLabelText('Search history'), 'question');

    const hitButton = await screen.findByRole('button', { name: /question/ });

    await userEvent.click(hitButton);

    expect(await screen.findByText('the answer')).toBeDefined();
  });
});

describe('HistoryApp header actions', () => {
  test('rescans projects from the header button', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      return toPath(url).endsWith('/projects') ? Response.json(projectPayload) : Response.json({ sessions: [] });
    },
    );

    vi.stubGlobal('fetch', fetchMock);
    render(<HistoryApp />);
    await screen.findByText('alpha');

    await userEvent.click(screen.getByTitle('Refresh conversation history'));

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => {
        return toPath(url).endsWith('/projects');
      }).length).toBeGreaterThanOrEqual(2);
    });
  });

  test('closes search via the backdrop close control', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: RequestInfo | URL) => {
        return toPath(url).endsWith('/projects') ? Response.json(projectPayload) : Response.json({ sessions: [] });
      },
      ),
    );
    render(<HistoryApp />);
    await screen.findByText('alpha');

    await userEvent.click(screen.getByTitle('Search all chats (press /)'));
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Search history')).toBeNull();
    });
  });
});

describe('HistoryApp project and session mutations', () => {
  test('finds only matching agent projects', () => {
    expect(findAgentProject(undefined, 'p', 'claude')).toBeNull();
    expect(findAgentProject(projectPayload.projects, 'missing', 'claude')).toBeNull();
    expect(findAgentProject(projectPayload.projects, 'proj-a', 'claude')).toMatchObject({ name: 'alpha' });
  });

  test('deletes project history and handles session rename and deletion', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const path = toPath(url);

      if (path.endsWith('/projects')) {
        return Response.json(projectPayload);
      }
      if (path.endsWith('/sessions')) {
        return Response.json(sessionsPayload('a'));
      }
      if (path.endsWith('/project-delete') || path.endsWith('/session-rename') || path.endsWith('/session-delete')) {
        return Response.json({ ok: true });
      }

      return Response.json(messagesPayload);
    });

    vi.stubGlobal('fetch', fetchMock);
    render(<HistoryApp />);
    await screen.findByText('alpha');
    await userEvent.click(screen.getByText('beta'));
    await screen.findByText('The chosen one');
    fireEvent.contextMenu(screen.getByText('beta'));
    await userEvent.click(screen.getByText('Delete project history'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => {
        return toPath(url).endsWith('/project-delete');
      })).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    fireEvent.contextMenu(screen.getByText('beta'));
    await userEvent.click(screen.getByText('Delete project history'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await userEvent.click(screen.getByText('alpha'));
    await screen.findByText('The chosen one');
    await userEvent.click(screen.getByText('The chosen one'));
    fireEvent.contextMenu(screen.getAllByText('The chosen one')[0] ?? document.body);
    await userEvent.click(screen.getByText('Rename session in Claude Code'));
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => {
        return toPath(url).endsWith('/session-rename');
      })).toBe(true);
    });

    fireEvent.contextMenu(screen.getAllByText('The chosen one')[0] ?? document.body);
    await userEvent.click(screen.getByText('Delete session'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => {
        return toPath(url).endsWith('/session-delete');
      })).toBe(true);
    });

    await userEvent.click(screen.getByText('alpha'));
    await screen.findByText('The chosen one');
    fireEvent.contextMenu(screen.getAllByText('The chosen one')[0] ?? document.body);
    await userEvent.click(screen.getByText('Delete session'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => {
        return toPath(url).endsWith('/session-delete');
      })).toHaveLength(2);
    });
  });
});

describe('HistoryApp degraded data', () => {
  test('still renders the analytics pane when projects fail to load', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      return new Response('{"error":"offline"}', { status: 500 });
    }));

    render(<HistoryApp />);

    await waitFor(() => {
      expect(screen.getByTitle('Refresh conversation history')).toBeDefined();
    });
    await userEvent.click(screen.getByRole('button', { name: /Analytics/ }));

    expect(await screen.findByText(/No analytics for/)).toBeDefined();
  });
});
