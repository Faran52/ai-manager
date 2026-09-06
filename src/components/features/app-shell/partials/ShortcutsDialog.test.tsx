import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { shortcutOrder } from '@config/shortcuts';

import { ShortcutsDialog } from './ShortcutsDialog';

const platform = (value: string): void => {
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    value,
  });
};

afterEach(() => {
  platform('');
});

describe('ShortcutsDialog', () => {
  test('stays shut until asked', () => {
    render(<ShortcutsDialog open={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('lists every binding once', () => {
    render(<ShortcutsDialog open onClose={vi.fn()} />);

    expect(screen.getAllByRole('term')).toHaveLength(shortcutOrder.length);
  });

  test('writes the modifier the way the platform does', () => {
    platform('MacIntel');
    render(<ShortcutsDialog open onClose={vi.fn()} />);

    expect(screen.getByText('⌘⇧M')).toBeDefined();
  });

  test('spells the modifier out away from Apple', () => {
    platform('Win32');
    render(<ShortcutsDialog open onClose={vi.fn()} />);

    expect(screen.getByText('Ctrl+Shift+M')).toBeDefined();
  });

  test('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<ShortcutsDialog open onClose={onClose} />);

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
