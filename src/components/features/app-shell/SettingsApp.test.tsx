import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
} from 'vitest';

import { themeStorageKey } from '@config/storageKeys';

import { SettingsApp } from './SettingsApp';

afterEach(() => {
  localStorage.clear();
});

test('fills its own window with the panes the sheet shows', () => {
  render(<SettingsApp />);

  expect(document.querySelector('[data-settings-window]')).not.toBeNull();
  expect(document.querySelector('[data-settings-rail]')).not.toBeNull();
  expect(screen.getByRole('heading', { name: 'Appearance' })).toBeDefined();
});

test('reads the preferences for itself, sharing no memory with the window that opened it', async () => {
  render(<SettingsApp />);

  await userEvent.click(screen.getByRole('radio', { name: 'Light' }));

  // What it writes is what the other window hears about.
  expect(localStorage.getItem(themeStorageKey)).toBe('light');
});
