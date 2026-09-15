import { initI18n } from '@i18n/index';
import {
  cleanup,
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

const picker = (): HTMLSelectElement => {
  return screen.getByRole('combobox');
};

describe('LanguagePicker', () => {
  test('follows the system until a language is chosen, and again on request', async () => {
    await i18n.changeLanguage('en');
    localStorage.removeItem(languageStorageKey);
    render(<LanguagePicker />);

    expect(picker().value).toBe('system');

    await userEvent.selectOptions(picker(), 'ko');

    expect(localStorage.getItem(languageStorageKey)).toBe('ko');
    expect(document.documentElement.lang).toBe('ko');

    await userEvent.selectOptions(picker(), 'system');

    await waitFor(() => {
      expect(localStorage.getItem(languageStorageKey)).toBeNull();
    });
  });

  test('lists every language and switches the active one', async () => {
    render(<LanguagePicker />);

    expect(screen.getByRole('option', { name: '日本語' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'العربية' })).toBeDefined();

    await userEvent.selectOptions(picker(), 'ja');

    expect(document.documentElement.lang).toBe('ja');
    expect(document.documentElement.dir).toBe('ltr');
  });

  test('flips the document direction for arabic and back', async () => {
    render(<LanguagePicker />);

    await userEvent.selectOptions(picker(), 'ar');

    expect(document.documentElement.dir).toBe('rtl');

    await userEvent.selectOptions(picker(), 'en');

    expect(document.documentElement.dir).toBe('ltr');
  });

  test('keeps the system entry addressable in any language', async () => {
    await i18n.changeLanguage('ko');
    render(<LanguagePicker />);

    expect(screen.getByRole('option', { name: /System|시스템/ })).toBeDefined();
    await userEvent.selectOptions(picker(), 'system');

    expect(picker().value).toBe('system');
  });
});
