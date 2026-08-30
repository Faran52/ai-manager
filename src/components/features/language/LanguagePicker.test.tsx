import { initI18n } from '@i18n/index';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { languageStorageKey } from '@config/storageKeys';

import { LanguagePicker } from './LanguagePicker';

const i18n = initI18n();

afterEach(() => {
  cleanup();
});

describe('LanguagePicker', () => {
  test('follows the system until a language is chosen, and again on request', async () => {
    await i18n.changeLanguage('en');
    localStorage.removeItem(languageStorageKey);
    render(<LanguagePicker />);

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('System')).toBeDefined();

    await userEvent.click(screen.getByText('한국어'));

    expect(localStorage.getItem(languageStorageKey)).toBe('ko');
    expect(document.documentElement.lang).toBe('ko');

    await userEvent.click(screen.getByRole('button'));
    // The menu is in Korean by now, so the system entry is found by its place.
    await userEvent.click(screen.getAllByRole('menuitem')[0] ?? document.body);

    await waitFor(() => {
      expect(localStorage.getItem(languageStorageKey)).toBeNull();
    });
  });

  test('marks the system as the choice in force while nothing is stored', async () => {
    await i18n.changeLanguage('en');
    localStorage.removeItem(languageStorageKey);
    render(<LanguagePicker />);

    await userEvent.click(screen.getByRole('button'));

    const items = screen.getAllByRole('menuitem');
    const system = items[0];

    expect(system?.textContent).toContain('System');
    expect(system?.querySelector('svg.text-primary')).not.toBeNull();
    expect(items[1]?.querySelector('svg.text-primary')).toBeNull();
  });

  test('lists every language and switches the active one', async () => {
    render(<LanguagePicker />);

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('日本語')).toBeDefined();
    expect(screen.getByText('العربية')).toBeDefined();

    await userEvent.click(screen.getByText('日本語'));

    expect(document.documentElement.lang).toBe('ja');
    expect(document.documentElement.dir).toBe('ltr');
  });

  test('flips the document direction for arabic and back', async () => {
    render(<LanguagePicker />);

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('العربية'));

    expect(document.documentElement.dir).toBe('rtl');

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('English'));

    expect(document.documentElement.dir).toBe('ltr');
  });

  test('closes the menu without choosing a language', async () => {
    render(<LanguagePicker />);

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('menu')).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });
});
