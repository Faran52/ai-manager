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

import { FontSizePicker } from './FontSizePicker';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-font-size');
});

const openPicker = async (): Promise<void> => {
  render(<FontSizePicker />);
  await userEvent.click(screen.getByTitle('Change text size'));
};

test('offers every size and marks the active one', async () => {
  localStorage.setItem('acm-font-size', 'large');
  await openPicker();

  for (const label of ['Compact', 'Normal', 'Large']) {
    expect(screen.getByText(label)).toBeDefined();
  }

  expect(screen.getByText('Large').parentElement?.querySelector('svg')).not.toBeNull();
  expect(screen.getByText('Compact').parentElement?.querySelector('svg')).toBeNull();
});

test('applies and persists a chosen size, then closes', async () => {
  await openPicker();
  await userEvent.click(screen.getByText('Compact'));

  expect(localStorage.getItem('acm-font-size')).toBe('compact');
  expect(document.documentElement.dataset.fontSize).toBe('compact');

  await waitFor(() => {
    expect(screen.queryByText('Compact')).toBeNull();
  });
});

test('dismisses without changing the size', async () => {
  await openPicker();
  await userEvent.keyboard('{Escape}');

  await waitFor(() => {
    expect(screen.queryByText('Compact')).toBeNull();
  });
  expect(localStorage.getItem('acm-font-size')).toBeNull();
});
