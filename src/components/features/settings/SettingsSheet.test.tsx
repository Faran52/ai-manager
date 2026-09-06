import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { SettingsSheet } from './SettingsSheet';

import type { AsyncResource } from '@features/history-data';
import type { ScopeSettings } from '@services/settings/settingsService';

const user = userEvent.setup({ pointerEventsCheck: 0 });

const SETTINGS: AsyncResource<readonly ScopeSettings[]> = {
  status: 'ready',
  data: [],
  reload: () => {
    return undefined;
  },
};

const sheet = (open = true): ReturnType<typeof render> => {
  return render(
    <SettingsSheet
      agent="claude"
      open={open}
      projectPath="/repo"
      settings={SETTINGS}
      themeMode="dark"
      onClose={vi.fn()}
      onSelectAgent={vi.fn()}
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

  /*
   * The appearance controls read inline rather than behind four icon buttons,
   * so every value is visible without opening anything.
   */
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

  test('reaches the agent settings it does not own', async () => {
    sheet();
    await user.click(screen.getByRole('button', { name: 'Agents' }));

    expect(screen.queryByRole('heading', { name: 'Appearance' })).toBeNull();
  });

  test('closes on Escape, like every other sheet', async () => {
    const onClose = vi.fn();

    render(
      <SettingsSheet
        agent="claude"
        open
        projectPath={null}
        settings={SETTINGS}
        themeMode="dark"
        onClose={onClose}
        onSelectAgent={vi.fn()}
        onThemeChange={vi.fn()}
      />,
    );
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
