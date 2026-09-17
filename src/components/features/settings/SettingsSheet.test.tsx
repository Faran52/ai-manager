import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { SettingsSheet } from './SettingsSheet';

const user = userEvent.setup({ pointerEventsCheck: 0 });

const sheet = (open = true): ReturnType<typeof render> => {
  return render(
    <SettingsSheet
      open={open}
      themeMode="dark"
      onClose={vi.fn()}
      onThemeChange={vi.fn()}
    />,
  );
};

describe('SettingsSheet', () => {
  test('stays shut until it is opened', () => {
    sheet(false);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('opens on Appearance, which is what every visit is for today', async () => {
    sheet();

    const entry = screen.getByRole('button', { name: 'Appearance' });

    expect(entry.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeDefined();

    // The rail stays for the panes to come, and choosing the open one is a no-op.
    await user.click(entry);

    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeDefined();
  });

  test('holds the look of the app rather than the header', () => {
    sheet();

    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cobalt' })).toBeDefined();
    expect(screen.getByRole('combobox')).toBeDefined();
  });

  test('leaves the build and its updates to the about window that carries them', () => {
    sheet();

    expect(screen.queryByText('Version')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'About' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'On launch' })).toBeNull();
  });

  test('closes on Escape, like every other sheet', async () => {
    const onClose = vi.fn();

    render(
      <SettingsSheet
        open
        themeMode="dark"
        onClose={onClose}
        onThemeChange={vi.fn()}
      />,
    );
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
