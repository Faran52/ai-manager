import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { projectsPaneStorageKey } from '@config/storageKeys';

import { SidebarPane } from './SidebarPane';

import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { SidebarPaneProps } from './SidebarPane';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const project = (id: string, name: string): ProjectSummary => {
  return {
    agent: 'claude',
    id,
    name,
    sessionCount: 2,
    messageCount: 5,
    lastActivityMs: Date.UTC(2026, 0, 1),
  };
};

const session = (id: string, title: string, projectId = 'p'): SessionSummary => {
  return {
    agent: 'claude',
    actualSessionId: id,
    id,
    filePath: `/r/${id}.jsonl`,
    projectId,
    title,
    messageCount: 4,
    firstTimestampMs: 0,
    lastTimestampMs: Date.UTC(2026, 0, 2),
    modifiedMs: 0,
    sizeBytes: 8,
  };
};

const base = {
  projectsStatus: 'ready',
  sessionsStatus: 'ready',
  selectedProject: project('p', 'selected'),
  selectedFilePath: null,
  nowMs: Date.UTC(2026, 0, 3),
  onSelectSession: () => {
    return undefined;
  },
  onSelectProject: () => {
    return undefined;
  },
  onDeleteProject: () => {
    return Promise.resolve();
  },
  onRenameSession: () => {
    return Promise.resolve();
  },
  onDeleteSession: () => {
    return Promise.resolve();
  },
} satisfies Omit<SidebarPaneProps, 'projects' | 'sessions'>;

const openProject = async (name: string, agent = 'Claude Code'): Promise<void> => {
  const label = screen.getByText(name);

  await userEvent.click(label);

  const item = label.closest('li');

  if (item != null) {
    await userEvent.click(within(item).getByText(agent));
  }
};

describe('SidebarPane', () => {
  test('restores and resizes the project pane', async () => {
    localStorage.setItem(projectsPaneStorageKey, '999');

    render(<SidebarPane {...base} projects={[]} sessions={[]} />);

    const divider = screen.getByRole('slider', { name: 'Resize projects and sessions' });

    expect(divider.getAttribute('aria-valuenow')).toBe('640');
    divider.focus();
    await userEvent.keyboard('{ArrowUp}');

    expect(divider.getAttribute('aria-valuenow')).toBe('616');
    await waitFor(() => {
      expect(localStorage.getItem(projectsPaneStorageKey)).toBe('616');
    });
  });

  test('lists projects and sessions with selection callbacks', async () => {
    const onSelectSession = vi.fn();

    render(
      <SidebarPane
        {...base}
        projects={[project('p', 'webapp')]}
        sessions={[{
          ...session('a', 'Login fix'),
          messageCount: 1,
        }]}
        onSelectSession={onSelectSession}
      />,
    );

    await openProject('webapp');
    await userEvent.click(screen.getByText('Login fix'));

    expect(screen.getByText('1 message')).toBeDefined();
    expect(onSelectSession).toHaveBeenCalledWith(expect.objectContaining({ filePath: '/r/a.jsonl' }));
  });

  test('filters projects and sessions independently', async () => {
    const selected = project('p1', 'webapp');

    render(
      <SidebarPane
        {...base}
        projects={[selected, project('p2', 'cli-tool')]}
        sessions={[session('a', 'Login fix', 'p1'), session('b', 'Deploy pipeline', 'p2')]}
      />,
    );

    await userEvent.type(screen.getByLabelText('Filter projects'), 'cli');

    expect(screen.queryByText('webapp')).toBeNull();
    expect(screen.getByText('cli-tool')).toBeDefined();
    expect(screen.getByText('Login fix')).toBeDefined();

    await userEvent.type(screen.getByLabelText('Filter sessions'), 'deploy');

    expect(screen.getByText('Deploy pipeline')).toBeDefined();
    expect(screen.queryByText('Login fix')).toBeNull();

    await userEvent.clear(screen.getByLabelText('Filter sessions'));
    await userEvent.type(screen.getByLabelText('Filter sessions'), 'missing');
    expect(screen.getByText('No sessions match')).toBeDefined();
  });

  test('shows a spinner while projects load', () => {
    render(
      <SidebarPane
        {...base}
        projects={[]}
        projectsStatus="loading"
        sessions={[]}
      />,
    );

    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  test('uses singular session counts and distinguishes empty session states', async () => {
    const selected = {
      ...project('p', 'webapp'),
      sessionCount: 1,
    };
    const { rerender } = render(
      <SidebarPane
        {...base}
        projects={[selected]}
        sessions={[]}
      />,
    );

    await openProject('webapp');
    expect(screen.getAllByText('1 session').length).toBeGreaterThan(0);
    expect(screen.getByText('No sessions yet')).toBeDefined();
    rerender(<SidebarPane {...base} projects={[selected]} sessions={[]} />);
  });
});

describe('SidebarPane selection highlighting', () => {
  test('marks the active session', async () => {
    render(
      <SidebarPane
        {...base}
        projects={[project('p', 'webapp')]}
        sessions={[session('a', 'Login fix')]}
        selectedFilePath="/r/a.jsonl"
      />,
    );

    await openProject('webapp');
    const active = document.querySelectorAll('[data-session-item][aria-current="true"]');

    expect(active).toHaveLength(1);
  });
});

describe('SidebarPane haystack sources', () => {
  test('matches against summary and preview when the title is absent', async () => {
    const selected = project('p', 'webapp');
    const summaryOnly = {
      ...session('c', ''),
      title: undefined,
      summary: 'reticulating splines',
      preview: undefined,
    };
    const previewOnly = {
      ...session('d', ''),
      title: undefined,
      summary: undefined,
      preview: 'grid layouts',
    };

    render(
      <SidebarPane
        {...base}
        projects={[selected]}
        sessions={[summaryOnly, previewOnly]}
      />,
    );

    await userEvent.type(screen.getByLabelText('Filter sessions'), 'splines');

    expect(screen.getByText('reticulating splines')).toBeDefined();
    expect(screen.queryByText('grid layouts')).toBeNull();
  });
});

describe('SidebarPane id fallback', () => {
  test('shows the raw id when a session carries no text fields', async () => {
    render(
      <SidebarPane
        {...base}
        projects={[project('p', 'webapp')]}
        sessions={[{
          ...session('bare', ''),
          title: undefined,
          summary: undefined,
          preview: undefined,
        }]}
      />,
    );

    await openProject('webapp');
    expect(screen.getByText('bare')).toBeDefined();
  });
});

describe('SidebarPane context actions', () => {
  test('copies project and session details from right-click menus', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const projectWithPath = {
      ...project('p1', 'webapp'),
      actualPath: "/repo/team's-app",
    };
    const sessionWithPath = {
      ...session('a', 'Login fix', 'p1'),
      cwd: "/repo/team's-app",
    };

    render(
      <SidebarPane
        {...base}
        projects={[projectWithPath, project('p2', 'pathless')]}
        sessions={[sessionWithPath, session('b', 'No cwd', 'p2')]}
      />,
    );

    fireEvent.contextMenu(screen.getByText('webapp'));
    await userEvent.click(screen.getByText('Copy project path'));
    fireEvent.contextMenu(screen.getByText('webapp'));
    await userEvent.click(screen.getByText('Copy project ID'));
    fireEvent.contextMenu(screen.getByText('pathless'));
    expect(screen.queryByText('Copy project path')).toBeNull();
    await userEvent.click(screen.getByText('Copy project ID'));

    await openProject('webapp');
    fireEvent.contextMenu(screen.getByText('Login fix'));
    await userEvent.click(screen.getByText('Copy session ID'));
    fireEvent.contextMenu(screen.getByText('Login fix'));
    await userEvent.click(screen.getByText('Copy resume command'));
    fireEvent.contextMenu(screen.getByText('Login fix'));
    await userEvent.click(screen.getByText('Copy session file path'));
    await openProject('pathless');
    fireEvent.contextMenu(screen.getByText('No cwd'));
    await userEvent.click(screen.getByText('Copy resume command'));

    expect(writeText).toHaveBeenNthCalledWith(1, "/repo/team's-app");
    expect(writeText).toHaveBeenNthCalledWith(2, 'p1');
    expect(writeText).toHaveBeenNthCalledWith(3, 'p2');
    expect(writeText).toHaveBeenNthCalledWith(4, 'a');
    expect(writeText).toHaveBeenNthCalledWith(5, "cd '/repo/team'\\''s-app' && claude --resume 'a'");
    expect(writeText).toHaveBeenNthCalledWith(6, '/r/a.jsonl');
    expect(writeText).toHaveBeenNthCalledWith(7, "claude --resume 'b'");
    expect(screen.getByRole('status').textContent).toBe('Resume command copied');
  });

  test('does not announce a rejected clipboard write', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn(() => {
          throw new Error('denied');
        }),
      },
    });

    render(<SidebarPane {...base} projects={[project('p1', 'webapp')]} sessions={[]} />);
    fireEvent.contextMenu(screen.getByText('webapp'));
    await userEvent.click(screen.getByText('Copy project ID'));

    expect(screen.queryByRole('status')).toBeNull();
  });

  test('labels session menus from every title fallback', async () => {
    const summaryOnly = {
      ...session('summary', ''),
      title: undefined,
      summary: 'Summary only',
    };
    const previewOnly = {
      ...session('preview', ''),
      title: undefined,
      preview: 'Preview only',
    };
    const idOnly = {
      ...session('raw-id', ''),
      title: undefined,
    };

    render(
      <SidebarPane
        {...base}
        projects={[project('p', 'webapp')]}
        sessions={[summaryOnly, previewOnly, idOnly]}
      />,
    );

    await openProject('webapp');

    for (const label of ['Summary only', 'Preview only', 'raw-id']) {
      fireEvent.contextMenu(screen.getByRole('button', { name: new RegExp(label, 'u') }));
      expect(screen.getByRole('menu').textContent).toContain(label);
      fireEvent.keyDown(window, { key: 'Escape' });
    }
  });
});

describe('SidebarPane agent and mutation actions', () => {
  test('filters agents and confirms project history deletion', async () => {
    const onDeleteProject = vi.fn(() => {
      return Promise.resolve();
    });
    const codexProject: ProjectSummary = {
      ...project('codex', 'codex-app'),
      agent: 'codex',
    };

    render(
      <SidebarPane
        {...base}
        projects={[project('claude', 'claude-app'), codexProject]}
        sessions={[]}
        onDeleteProject={onDeleteProject}
      />,
    );

    expect(screen.getByText('codex-app')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: /Filter agents/u }));
    await userEvent.click(screen.getByRole('button', { name: 'Claude Code' }));
    expect(screen.queryByText('codex-app')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'All agents' }));
    expect(screen.getByText('codex-app')).toBeDefined();

    fireEvent.contextMenu(screen.getByText('claude-app'));
    await userEvent.click(screen.getByText('Delete project history'));
    expect(screen.getByText(/source project folder on disk is untouched/u)).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(onDeleteProject).toHaveBeenCalledWith(expect.objectContaining({ id: 'claude' }));
  });

  test('renames and deletes sessions through confirmed dialogs', async () => {
    const onRenameSession = vi.fn(() => {
      return Promise.resolve();
    });
    const onDeleteSession = vi.fn(() => {
      return Promise.resolve();
    });

    render(
      <SidebarPane
        {...base}
        projects={[project('p', 'app')]}
        sessions={[session('a', 'Old title')]}
        onRenameSession={onRenameSession}
        onDeleteSession={onDeleteSession}
      />,
    );

    await openProject('app');
    fireEvent.contextMenu(screen.getByText('Old title'));
    await userEvent.click(screen.getByText('Rename session in Claude Code'));
    await userEvent.clear(screen.getByLabelText('Session title'));
    await userEvent.type(screen.getByLabelText('Session title'), 'New title');
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(onRenameSession).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), 'New title');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    fireEvent.contextMenu(screen.getByText('Old title'));
    await userEvent.click(screen.getByText('Delete session'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(onDeleteSession).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  test('selects multiple sessions and only offers bulk deletion', async () => {
    const onDeleteSession = vi.fn(() => {
      return Promise.resolve();
    });

    render(
      <SidebarPane
        {...base}
        projects={[project('p', 'app')]}
        sessions={[session('a', 'First session'), session('b', 'Second session')]}
        onDeleteSession={onDeleteSession}
      />,
    );

    await openProject('app');
    await userEvent.click(screen.getByRole('button', { name: 'Select sessions' }));
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Select sessions' })).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Select sessions' }));
    await userEvent.click(screen.getByRole('button', { name: 'Select all sessions' }));
    expect(screen.getByText('2 selected')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Clear selected sessions' }));
    expect(screen.getByText('0 selected')).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: /First session/u }));
    await userEvent.click(screen.getByRole('button', { name: /First session/u }));
    await userEvent.click(screen.getByRole('button', { name: /First session/u }));
    await userEvent.click(screen.getByRole('button', { name: /Second session/u }));
    fireEvent.contextMenu(screen.getByText('First session'));
    expect(screen.queryByText(/Rename in/u)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete 2 permanently' }));

    await waitFor(() => {
      expect(onDeleteSession).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Select sessions' })).toBeDefined();
  });

  test('reports mutation failures and lets dialogs dismiss', async () => {
    const failingProjectDelete = vi.fn(() => {
      return Promise.reject(new Error('project delete denied'));
    });
    const failingRename = vi.fn(() => {
      return Promise.reject(new Error('rename denied'));
    });
    const failingDelete = vi.fn(() => {
      return Promise.reject(new Error('delete denied'));
    });

    render(
      <SidebarPane
        {...base}
        projects={[project('p', 'app')]}
        sessions={[session('a', 'Old title')]}
        onDeleteProject={failingProjectDelete}
        onRenameSession={failingRename}
        onDeleteSession={failingDelete}
      />,
    );

    fireEvent.contextMenu(screen.getByText('app'));
    await userEvent.click(screen.getByText('Delete project history'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect((await screen.findByRole('alert')).textContent).toBe('project delete denied');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await openProject('app');
    fireEvent.contextMenu(screen.getByText('Old title'));
    await userEvent.click(screen.getByText('Rename session in Claude Code'));
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect((await screen.findByRole('alert')).textContent).toBe('rename denied');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    fireEvent.contextMenu(screen.getByText('Old title'));
    await userEvent.click(screen.getByText('Delete session'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect((await screen.findByRole('alert')).textContent).toBe('delete denied');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
