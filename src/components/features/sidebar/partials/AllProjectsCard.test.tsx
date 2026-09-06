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

describe('AllProjectsCard', () => {
  test('counts every session and every project', () => {
    render(<AllProjectsCard projects={PROJECTS} selected={false} onSelect={vi.fn()} />);

    expect(screen.getByText('35 sessions')).toBeDefined();
    expect(screen.getByText('3 projects')).toBeDefined();
  });

  test('tallies each agent across all of them, heaviest first', () => {
    render(<AllProjectsCard projects={PROJECTS} selected={false} onSelect={vi.fn()} />);

    const agents = screen.getAllByText(/Claude Code|Codex CLI/u);

    expect(agents[0]?.textContent).toContain('Claude Code');
    expect(screen.getByText('22')).toBeDefined();
    expect(screen.getByText('13')).toBeDefined();
  });

  test('reports whether it is the scope in view', () => {
    render(<AllProjectsCard projects={PROJECTS} selected onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { pressed: true })).toBeDefined();
  });

  test('asks for every project when pressed', async () => {
    const onSelect = vi.fn();

    render(<AllProjectsCard projects={PROJECTS} selected={false} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('says nothing about agents before any project has loaded', () => {
    render(<AllProjectsCard projects={[]} selected={false} onSelect={vi.fn()} />);

    expect(screen.getByText('0 projects')).toBeDefined();
    expect(screen.queryByText('Claude Code')).toBeNull();
  });
});
