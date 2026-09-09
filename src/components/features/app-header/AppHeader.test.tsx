import {
  act,
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

import { AppHeader } from './AppHeader';

import type { AppHeaderProps } from './AppHeader';

afterEach(() => {
  vi.useRealTimers();
});

const mount = (overrides?: Partial<Parameters<typeof AppHeader>[0]>) => {
  const props = {
    onOpenSearch: vi.fn(),
    onReload: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  } satisfies AppHeaderProps;

  render(<AppHeader {...props} />);

  return props;
};

describe('AppHeader', () => {
  test('wires search and reload', async () => {
    const props = mount();

    await userEvent.click(screen.getByRole('button', { name: 'Search all chats (press /)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Refresh conversation history' }));

    expect(props.onOpenSearch).toHaveBeenCalledOnce();
    expect(props.onReload).toHaveBeenCalledOnce();
  });

  test('shows refresh progress for three seconds', async () => {
    vi.useFakeTimers();
    const props = mount();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh conversation history' }));

    expect(props.onReload).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe('Refreshing conversation history…');
    expect(screen.getByRole('button', { name: 'Refreshing conversation history' })
      .hasAttribute('disabled')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(screen.queryByText('Refreshing conversation history…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Refresh conversation history' })
      .hasAttribute('disabled')).toBe(false);
  });
});
