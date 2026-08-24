import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
} from 'vitest';

import { AccentPicker } from './AccentPicker';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-accent');
});

const openPicker = async (): Promise<void> => {
  render(<AccentPicker />);
  await userEvent.click(screen.getByTitle('Change accent colour'));
};

test('offers every accent and marks the active one', async () => {
  localStorage.setItem('acm-accent', 'rose');
  await openPicker();

  for (const label of ['Teal', 'Iris', 'Amber', 'Rose', 'Lime', 'Sky']) {
    expect(screen.getByText(label)).toBeDefined();
  }

  expect(screen.getByText('Rose').parentElement?.querySelector('svg')).not.toBeNull();
  expect(screen.getByText('Teal').parentElement?.querySelector('svg')).toBeNull();
});

test('applies and persists a chosen accent, then closes', async () => {
  await openPicker();
  await userEvent.click(screen.getByText('Sky'));

  expect(localStorage.getItem('acm-accent')).toBe('sky');
  expect(document.documentElement.dataset.accent).toBe('sky');

  await waitFor(() => {
    expect(screen.queryByText('Sky')).toBeNull();
  });
});

test('dismisses without changing the accent', async () => {
  await openPicker();
  await userEvent.keyboard('{Escape}');

  await waitFor(() => {
    expect(screen.queryByText('Sky')).toBeNull();
  });
  expect(localStorage.getItem('acm-accent')).toBeNull();
});
