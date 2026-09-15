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

import { ToastProvider } from '@ui/index';

import { NavRail } from './NavRail';

import type { NavRailProps } from './NavRail';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const mount = (overrides: Partial<NavRailProps> = {}): NavRailProps => {
  const props: NavRailProps = {
    flagged: 0,
    view: 'sessions',
    onViewChange: vi.fn(),
    onReload: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };

  render(
    <ToastProvider>
      <NavRail {...props} />
    </ToastProvider>,
  );

  return props;
};

describe('NavRail', () => {
  test('offers the four places you work, then refresh and settings', () => {
    mount();

    expect(screen.getAllByRole('button').map((node) => {
      return node.getAttribute('aria-label');
    })).toEqual([
      'Sessions',
      'Analytics',
      'Archive',
      'Health',
      'Refresh conversation history',
      'Settings',
    ]);
  });

  test('marks where you are for assistive technology', () => {
    mount({ view: 'analytics' });

    expect(screen.getByRole('button', { name: 'Analytics' }).getAttribute('aria-current'))
      .toBe('page');
    expect(screen.getByRole('button', { name: 'Sessions' }).getAttribute('aria-current'))
      .toBeNull();
  });

  test('still marks the active view for a reduced-motion reader', () => {
    vi.stubGlobal('matchMedia', () => {
      return {
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    });

    mount({ view: 'archive' });

    expect(screen.getByRole('button', { name: 'Archive' }).getAttribute('aria-current'))
      .toBe('page');
  });

  test('goes where it is sent', async () => {
    const { onViewChange } = mount();

    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));

    expect(onViewChange).toHaveBeenCalledWith('archive');
  });

  test('counts waiting findings on Health', () => {
    mount({ flagged: 2 });

    expect(screen.getByText('2')).toBeDefined();
  });

  test('says nothing when there is nothing wrong', () => {
    mount();

    expect(screen.queryByText('0')).toBeNull();
  });

  test('names each icon for a keyboard user', async () => {
    mount();
    await userEvent.tab();

    expect(await screen.findByRole('tooltip')).toBeDefined();
  });

  test('opens settings', async () => {
    const { onOpenSettings } = mount();

    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  test('reloads, and shows refresh progress for three seconds', async () => {
    vi.useFakeTimers();
    const { onReload } = mount();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh conversation history' }));

    expect(onReload).toHaveBeenCalledOnce();
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
