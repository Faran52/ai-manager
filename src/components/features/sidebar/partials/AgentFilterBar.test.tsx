import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { AgentFilterBar } from './AgentFilterBar';

const option = (name: string): HTMLElement => {
  return screen.getByRole('menuitemcheckbox', { name: new RegExp(name) });
};

test('summarises all projects and exposes every agent it can offer', async () => {
  const onChange = vi.fn();

  render(
    <AgentFilterBar
      active={[]}
      available={['claude', 'codex']}
      counts={new Map([['claude', 3], ['codex', 2]])}
      onChange={onChange}
    />,
  );

  const trigger = screen.getByRole('button', { name: 'Filter agents: All agents, 5 projects' });

  expect(trigger).toBeDefined();
  await userEvent.click(trigger);

  expect(option('All agents').getAttribute('aria-checked')).toBe('true');
  expect(screen.getByText('Popular agents')).toBeDefined();
  expect(option('Claude Code').getAttribute('aria-checked')).toBe('false');
  await userEvent.click(option('Codex CLI'));
  expect(onChange).toHaveBeenCalledWith(['codex']);
});

/*
 * An agent with nothing recorded used to sit in the list greyed out. A row that
 * cannot be chosen is absent instead, so the list only ever offers real work.
 */
test('leaves out an agent this list cannot offer', async () => {
  render(
    <AgentFilterBar
      active={[]}
      available={['claude']}
      counts={new Map([['claude', 3]])}
      onChange={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: /Filter agents/ }));

  expect(screen.queryByRole('menuitemcheckbox', { name: /Gemini CLI/ })).toBeNull();
  expect(screen.queryByText('More supported')).toBeNull();
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
  await userEvent.click(option('Codex CLI'));
  expect(onChange).toHaveBeenLastCalledWith(['claude', 'codex']);

  rerender(
    <AgentFilterBar
      active={['claude']}
      available={['claude', 'codex']}
      counts={new Map([['claude', 3], ['codex', 2]])}
      onChange={onChange}
    />,
  );
  await userEvent.click(option('Claude Code'));
  expect(onChange).toHaveBeenLastCalledWith([]);
});

/*
 * Ticking one agent leaves the menu open. A filter list is read as a set, and
 * closing per row would make choosing three agents three round trips.
 */
test('stays open while the set is being built', async () => {
  render(
    <AgentFilterBar
      active={[]}
      available={['claude', 'codex']}
      counts={new Map([['claude', 3], ['codex', 2]])}
      onChange={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: /Filter agents/ }));
  await userEvent.click(option('Codex CLI'));

  expect(screen.getByRole('menu')).toBeDefined();
});

/*
 * An agent can be available with nothing counted for it yet, so every figure
 * here falls back to zero rather than printing undefined into the summary.
 */
test('counts an agent with no figure recorded as none', async () => {
  render(
    <AgentFilterBar
      active={[]}
      available={['claude', 'codex']}
      counts={new Map([['claude', 3]])}
      onChange={vi.fn()}
    />,
  );

  const trigger = screen.getByRole('button', { name: 'Filter agents: All agents, 3 projects' });

  expect(trigger).toBeDefined();
  await userEvent.click(trigger);

  expect(option('Codex CLI').textContent).toContain('0');
});
