import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { AgentFilterBar } from './AgentFilterBar';

test('summarises all projects and exposes every supported agent', async () => {
  const onChange = vi.fn();

  render(
    <AgentFilterBar
      active={[]}
      available={['claude', 'codex']}
      counts={new Map([['claude', 3], ['codex', 2]])}
      onChange={onChange}
    />,
  );

  expect(screen.getByRole('button', { name: 'Filter agents: All agents, 5 projects' })).toBeDefined();
  await userEvent.click(screen.getByRole('button', { name: 'Filter agents: All agents, 5 projects' }));

  expect(screen.getByRole('button', { name: 'All agents' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('Popular agents')).toBeDefined();
  expect(screen.getByText('More supported')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Claude Code' }).getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByRole('button', { name: 'Gemini CLI' }).hasAttribute('disabled')).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: 'Codex CLI' }));
  expect(onChange).toHaveBeenCalledWith(['codex']);
});

test('adds and removes agent selections and resets to all', async () => {
  const onChange = vi.fn();

  const { rerender } = render(
    <AgentFilterBar
      active={['claude']}
      available={['claude', 'codex']}
      counts={new Map([['claude', 3], ['codex', 2]])}
      onChange={onChange}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Filter agents: Claude Code, 3 projects' }));
  await userEvent.click(screen.getByRole('button', { name: 'Codex CLI' }));
  expect(onChange).toHaveBeenLastCalledWith(['claude', 'codex']);

  rerender(
    <AgentFilterBar
      active={['claude']}
      available={['claude', 'codex']}
      counts={new Map([['claude', 3], ['codex', 2]])}
      onChange={onChange}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Claude Code' }));
  expect(onChange).toHaveBeenLastCalledWith([]);

  await userEvent.click(screen.getByRole('button', { name: 'All agents' }));
  expect(onChange).toHaveBeenLastCalledWith([]);
});

test('treats an available agent without a count as empty', () => {
  render(
    <AgentFilterBar
      active={[]}
      available={['claude']}
      counts={new Map()}
      onChange={vi.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'Filter agents: All agents, 0 projects' })).toBeDefined();
});
