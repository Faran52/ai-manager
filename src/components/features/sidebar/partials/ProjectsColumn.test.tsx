import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { ProjectsColumn } from './ProjectsColumn';

import type { AgentId } from '@config/agents';
import type { ProjectSummary } from '@services/history/historyService';
import type { ProjectsColumnProps } from './ProjectsColumn';

const project = (id: string, name: string, agent: AgentId = 'claude'): ProjectSummary => {
  return {
    agent,
    id,
    name,
    sessionCount: 2,
    messageCount: 5,
    lastActivityMs: Date.UTC(2026, 0, 1),
  };
};

const noop = (): void => {
  return undefined;
};

const base: ProjectsColumnProps = {
  open: true,
  width: 260,
  onOpen: noop,
  onClose: noop,
  projects: [project('a', 'webapp'), project('b', 'cli', 'codex')],
  projectsStatus: 'ready',
  selectedProject: null,
  nowMs: Date.UTC(2026, 0, 3),
  wholeMachine: false,
  reportScope: null,
  showAllProjects: true,
  showAgentChips: true,
  onSelectProject: noop,
  onSelectAllProjects: noop,
  onSelectReportAgent: noop,
  onOpenMenu: noop,
};

describe('ProjectsColumn', () => {
  test('counts the projects, filters them by name and folds away', async () => {
    const onClose = vi.fn();

    render(<ProjectsColumn {...base} onClose={onClose} />);

    await userEvent.type(screen.getByLabelText('Filter projects'), 'cli');
    expect(screen.queryByText('webapp')).toBeNull();
    expect(screen.getByText('cli')).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'Hide projects' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('narrows to one agent from the funnel and widens back out', async () => {
    render(<ProjectsColumn {...base} />);

    await userEvent.click(screen.getByRole('button', { name: 'Filter and sort projects' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Agents/u }));
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: /Claude Code/u }));
    expect(screen.getByText('webapp')).toBeDefined();
    expect(screen.queryByText('cli')).toBeNull();

    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /All agents/u }));
    expect(screen.getByText('cli')).toBeDefined();
  });

  test('folded, its strip carries the scope card and every project', async () => {
    const onSelectAllProjects = vi.fn();
    const onSelectProject = vi.fn();
    const onOpen = vi.fn();

    render(
      <ProjectsColumn
        {...base}
        open={false}
        onOpen={onOpen}
        onSelectAllProjects={onSelectAllProjects}
        onSelectProject={onSelectProject}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'All projects' }));
    await userEvent.click(screen.getByRole('button', { name: 'webapp' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show projects' }));

    expect(onSelectAllProjects).toHaveBeenCalledTimes(1);
    expect(onSelectProject).toHaveBeenCalledWith(base.projects[0]);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
