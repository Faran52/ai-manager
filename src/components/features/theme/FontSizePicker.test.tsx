import { render, screen } from '@testing-library/react';
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

test('offers every size and marks the active one', () => {
  localStorage.setItem('acm-font-size', 'large');
  render(<FontSizePicker />);

  for (const label of ['Compact', 'Normal', 'Large']) {
    expect(screen.getByRole('radio', { name: label })).toBeDefined();
  }

  expect(screen.getByRole('radio', { name: 'Large' })).toHaveProperty('checked', true);
  expect(screen.getByRole('radio', { name: 'Compact' })).toHaveProperty('checked', false);
});

test('applies and persists a chosen size', async () => {
  render(<FontSizePicker />);
  await userEvent.click(screen.getByRole('radio', { name: 'Compact' }));

  expect(localStorage.getItem('acm-font-size')).toBe('compact');
  expect(document.documentElement.dataset.fontSize).toBe('compact');
});

test('leaves the stored size alone until one is chosen', () => {
  render(<FontSizePicker />);

  expect(localStorage.getItem('acm-font-size')).toBeNull();
  expect(screen.getByRole('radio', { name: 'Normal' })).toHaveProperty('checked', true);
});
