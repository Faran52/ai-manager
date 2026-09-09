import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { FunnelMenu } from './FunnelMenu';

import type { FunnelMenuProps } from './FunnelMenu';

const renderMenu = (props: Partial<FunnelMenuProps> = {}): FunnelMenuProps => {
  const merged: FunnelMenuProps = {
    label: 'Filter and sort',
    dateFilter: 'all',
    onDateFilterChange: vi.fn(),
    order: 'newest',
    onOrderChange: vi.fn(),
    ...props,
  };

  render(<FunnelMenu {...merged} />);

  return merged;
};

const open = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: 'Filter and sort' }));
};

const openSub = async (name: RegExp): Promise<void> => {
  await userEvent.click(await screen.findByRole('menuitem', { name }));
};

describe('FunnelMenu', () => {
  test('reads the list from either end of its history', async () => {
    const { onOrderChange } = renderMenu();

    await open();
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Oldest first' }));

    expect(onOrderChange).toHaveBeenCalledWith('oldest');
  });

  test('narrows to a rolling date window', async () => {
    const { onDateFilterChange } = renderMenu();

    await open();
    await openSub(/Date/u);
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 7 days' }));

    expect(onDateFilterChange).toHaveBeenCalledWith('week');
  });

  test('leaves agents out when the column offers none', async () => {
    renderMenu();

    await open();

    expect(screen.queryByRole('menuitem', { name: /Agents/u })).toBeNull();
  });

  test('offers only the agents the column actually holds', async () => {
    const onToggle = vi.fn();
    const onClear = vi.fn();

    renderMenu({
      agents: {
        counts: new Map([['claude', 4], ['codex', 2]]),
        active: ['codex'],
        onToggle,
        onClear,
      },
    });

    await open();
    await openSub(/Agents/u);

    expect(screen.queryByRole('menuitemcheckbox', { name: /Gemini/u })).toBeNull();

    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: /Claude Code/u }));
    expect(onToggle).toHaveBeenCalledWith('claude');

    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /All agents/u }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('shows every offered agent checked while nothing narrows the list', async () => {
    renderMenu({
      agents: {
        counts: new Map([['claude', 4], ['codex', 2]]),
        active: [],
        onToggle: vi.fn(),
        onClear: vi.fn(),
      },
    });

    await open();
    await openSub(/Agents/u);

    expect(await screen.findByRole('menuitemcheckbox', {
      name: /Claude Code/u,
      checked: true,
    })).toBeDefined();
    expect(screen.getByRole('menuitemcheckbox', {
      name: /Codex CLI/u,
      checked: true,
    })).toBeDefined();
  });

  test('marks its trigger once a filter is narrowing the list', () => {
    renderMenu({ dateFilter: 'month' });

    expect(screen.getByRole('button', { name: 'Filter and sort' }).dataset.active).toBe('true');
  });

  test('leaves the trigger unmarked when nothing is narrowed', () => {
    renderMenu();

    expect(screen.getByRole('button', { name: 'Filter and sort' }).dataset.active).toBe('false');
  });
});
