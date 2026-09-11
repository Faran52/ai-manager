import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { AllProjectsCard } from './AllProjectsCard';

import type { ProjectSummary } from '@services/history/historyService';
import type { AllProjectsCardProps } from './AllProjectsCard';

const PROJECTS: readonly ProjectSummary[] = [
  {
    agent: 'claude',
    id: 'a',
    name: 'alpha',
    actualPath: '/repo/alpha',
    sessionCount: 19,
    messageCount: 40,
    lastActivityMs: 0,
  },
  {
    agent: 'codex',
    id: 'b',
    name: 'beta',
    actualPath: '/repo/beta',
    sessionCount: 13,
    messageCount: 20,
    lastActivityMs: 0,
  },
  {
    agent: 'claude',
    id: 'c',
    name: 'gamma',
    actualPath: '/repo/gamma',
    sessionCount: 3,
    messageCount: 5,
    lastActivityMs: 0,
  },
];

const renderCard = (props: Partial<AllProjectsCardProps> = {}): AllProjectsCardProps => {
  const merged: AllProjectsCardProps = {
    projects: PROJECTS,
    selected: false,
    onSelect: vi.fn(),
    selectedAgent: null,
    onSelectAgent: vi.fn(),
    ...props,
  };

  render(<AllProjectsCard {...merged} />);

  return merged;
};

describe('AllProjectsCard', () => {
  test('counts every session and every project', () => {
    renderCard();

    expect(screen.getByText('35 sessions')).toBeDefined();
    expect(screen.getByText('3 projects')).toBeDefined();
  });

  test('tallies each agent across all of them, heaviest first', () => {
    renderCard();

    const agents = screen.getAllByText(/Claude Code|Codex CLI/u);

    expect(agents[0]?.textContent).toContain('Claude Code');
    expect(screen.getByText('22')).toBeDefined();
    expect(screen.getByText('13')).toBeDefined();
  });

  test('reports whether it is the scope in view', () => {
    renderCard({ selected: true });

    expect(screen.getByRole('button', {
      name: 'All projects',
      pressed: true,
    })).toBeDefined();
  });

  test('asks for every project when pressed', async () => {
    const { onSelect } = renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'All projects' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('selects an agent to scope the report to when its tally is clicked', async () => {
    const { onSelectAgent } = renderCard({ selectedAgent: 'codex' });

    expect(screen.getByRole('button', {
      name: /Codex CLI/u,
      pressed: true,
    })).toBeDefined();
    expect(screen.getByRole('button', {
      name: /Claude Code/u,
      pressed: false,
    })).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: /Claude Code/u }));

    expect(onSelectAgent).toHaveBeenCalledWith('claude');
  });

  test('says nothing about agents before any project has loaded', () => {
    renderCard({ projects: [] });

    expect(screen.getByText('0 projects')).toBeDefined();
    expect(screen.queryByText('Claude Code')).toBeNull();
  });
});
