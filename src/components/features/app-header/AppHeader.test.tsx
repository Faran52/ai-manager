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
    view: 'sessions',
    onViewChange: vi.fn(),
    onOpenSearch: vi.fn(),
    onReload: vi.fn(),
    themeMode: 'light',
    onThemeChange: vi.fn(),
    ...overrides,
  } satisfies AppHeaderProps;

  render(<AppHeader {...props} />);

  return props;
};

describe('AppHeader', () => {
  test('switches between the two views', async () => {
    const props = mount();

    await userEvent.click(screen.getByRole('button', { name: /Analytics/ }));
    expect(props.onViewChange).toHaveBeenCalledWith('analytics');

    await userEvent.click(screen.getByRole('button', { name: /Sessions/ }));
    expect(props.onViewChange).toHaveBeenCalledWith('sessions');

    await userEvent.click(screen.getByRole('button', { name: /Health/ }));
    expect(props.onViewChange).toHaveBeenCalledWith('health');
  });

  test('marks the active view as pressed', () => {
    mount({ view: 'health' });

    expect(screen.getByRole('button', { name: /Health/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Analytics/ }).getAttribute('aria-pressed')).toBe('false');
  });

  test('wires search and reload', async () => {
    const props = mount();

    await userEvent.click(screen.getByTitle('Search all chats (press /)'));
    await userEvent.click(screen.getByTitle('Refresh conversation history'));

    expect(props.onOpenSearch).toHaveBeenCalledOnce();
    expect(props.onReload).toHaveBeenCalledOnce();
  });

  test('picks a theme directly, without cycling through one that looks the same', async () => {
    const props = mount({ themeMode: 'dark' });

    await userEvent.click(screen.getByTitle('Theme: Dark'));
    await userEvent.click(screen.getByText('Light'));

    expect(props.onThemeChange).toHaveBeenCalledWith('light');
  });

  test('shows refresh progress for three seconds', async () => {
    vi.useFakeTimers();
    const props = mount();

    fireEvent.click(screen.getByTitle('Refresh conversation history'));

    expect(props.onReload).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe('Refreshing conversation history…');
    expect(screen.getByTitle('Refreshing conversation history').hasAttribute('disabled')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(screen.queryByText('Refreshing conversation history…')).toBeNull();
    expect(screen.getByTitle('Refresh conversation history').hasAttribute('disabled')).toBe(false);
  });
});
