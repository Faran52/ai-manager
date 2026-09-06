import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { NavRail } from './NavRail';

describe('NavRail', () => {
  test('offers the four places you work, and not settings', () => {
    render(<NavRail flagged={0} view="sessions" onViewChange={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
  });

  test('marks where you are for assistive technology', () => {
    render(<NavRail flagged={0} view="analytics" onViewChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Analytics' }).getAttribute('aria-current'))
      .toBe('page');
    expect(screen.getByRole('button', { name: 'Sessions' }).getAttribute('aria-current'))
      .toBeNull();
  });

  test('goes where it is sent', async () => {
    const onViewChange = vi.fn();

    render(<NavRail flagged={0} view="sessions" onViewChange={onViewChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));

    expect(onViewChange).toHaveBeenCalledWith('archive');
  });

  test('counts waiting findings on Health', () => {
    render(<NavRail flagged={2} view="sessions" onViewChange={vi.fn()} />);

    expect(screen.getByText('2')).toBeDefined();
  });

  test('says nothing when there is nothing wrong', () => {
    render(<NavRail flagged={0} view="sessions" onViewChange={vi.fn()} />);

    expect(screen.queryByText('0')).toBeNull();
  });

  test('names each icon for a keyboard user', async () => {
    render(<NavRail flagged={0} view="sessions" onViewChange={vi.fn()} />);
    await userEvent.tab();

    expect(await screen.findByRole('tooltip')).toBeDefined();
  });
});
