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

  test('opens on Appearance, which is what most visits are for', () => {
    sheet();

    expect(screen.getByRole('button', { name: 'Appearance' }).getAttribute('aria-current'))
      .toBe('page');
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeDefined();
  });

  test('holds the look of the app rather than the header', () => {
    sheet();

    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Teal' })).toBeDefined();
    expect(screen.getByRole('combobox')).toBeDefined();
  });

  test('moves between panes', async () => {
    sheet();
    await user.click(screen.getByRole('button', { name: 'About' }));

    expect(screen.getByRole('heading', { name: 'About' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Appearance' })).toBeNull();
  });

  test('names the build it is', async () => {
    sheet();
    await user.click(screen.getByRole('button', { name: 'About' }));

    expect(screen.getByText('Version')).toBeDefined();
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
