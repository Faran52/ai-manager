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

import { LanguagePicker } from './LanguagePicker';

initI18n();

afterEach(() => {
  cleanup();
});

describe('LanguagePicker', () => {
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
