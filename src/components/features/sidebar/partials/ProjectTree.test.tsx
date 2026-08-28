import { initI18n } from '@i18n/index';
import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { ProjectTree } from './ProjectTree';

import type { ProjectSummary } from '@services/history/historyService';
import type { ComponentProps } from 'react';

initI18n();

const PROJECT: ProjectSummary = {
  agent: 'claude',
  id: 'project',
  name: 'Workspace',
  actualPath: '/repo/workspace',
  sessionCount: 1,
  messageCount: 4,
  lastActivityMs: 4,
};

const base = {
  projects: [PROJECT],
  projectsStatus: 'ready',
  agentFilter: [],
  textFilter: '',
  selectedProject: null,
  nowMs: 5,
  onSelectProject: () => {
    return undefined;
  },
  onOpenMenu: () => {
    return undefined;
  },
} satisfies ComponentProps<typeof ProjectTree>;

afterEach(async () => {
  await initI18n().changeLanguage('en');
});

describe('ProjectTree', () => {
  test('renders loading and empty states', () => {
    const { rerender } = render(<ProjectTree {...base} projectsStatus="loading" />);

    expect(document.querySelector('[data-projects-loading]')).not.toBeNull();

    rerender(<ProjectTree {...base} projects={[]} />);

    expect(screen.getByText('No project selected')).toBeDefined();
  });

  test('selects the first provider from the card and exact providers from pills', async () => {
    const onSelectProject = vi.fn();
    const onOpenMenu = vi.fn();
    const codexProject: ProjectSummary = {
      ...PROJECT,
      agent: 'codex',
      id: 'codex-project',
      sessionCount: 2,
      lastActivityMs: 8,
    };
    const pathlessProject: ProjectSummary = {
      ...PROJECT,
      id: 'pathless-project',
      name: 'Sidecar',
      actualPath: undefined,
    };

    render(
      <ProjectTree
        {...base}
        projects={[PROJECT, codexProject, pathlessProject]}
        selectedProject={PROJECT}
        onSelectProject={onSelectProject}
        onOpenMenu={onOpenMenu}
      />,
    );

    const card = screen.getByRole('button', { name: 'Select a project: Workspace' });
    const claude = screen.getByRole('button', { name: 'Workspace, Claude Code, 1 session' });

    await userEvent.click(card);
    expect(onSelectProject).toHaveBeenLastCalledWith(codexProject);

    await userEvent.click(claude);
    expect(onSelectProject).toHaveBeenLastCalledWith(PROJECT);
    expect(claude.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('3 sessions')).toBeDefined();
    expect(screen.getByText('Sidecar')).toBeDefined();

    fireEvent.contextMenu(card);
    fireEvent.contextMenu(claude);
    expect(onOpenMenu).toHaveBeenNthCalledWith(1, expect.anything(), codexProject);
    expect(onOpenMenu).toHaveBeenNthCalledWith(2, expect.anything(), PROJECT);
  });

  test('shows the empty state when navigation filters have no match', () => {
    render(<ProjectTree {...base} textFilter="missing" />);

    expect(screen.getByText('No project selected')).toBeDefined();
  });
});
