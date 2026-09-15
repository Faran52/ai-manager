import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
} from 'vitest';

import { UpdatePreference } from './UpdatePreference';

afterEach(() => {
  localStorage.clear();
});

test('checks on launch until told otherwise', () => {
  render(<UpdatePreference />);

  expect(screen.getByRole('radio', { name: 'Check on launch' })).toHaveProperty('checked', true);
});

test('persists the choice to never check', async () => {
  render(<UpdatePreference />);
  await userEvent.click(screen.getByRole('radio', { name: 'Never' }));

  expect(localStorage.getItem('acm-update-check')).toBe('never');
});

test('reads a stored choice back', () => {
  localStorage.setItem('acm-update-check', 'never');
  render(<UpdatePreference />);

  expect(screen.getByRole('radio', { name: 'Never' })).toHaveProperty('checked', true);
});

test('falls back to checking when the stored value is not one of the two', () => {
  localStorage.setItem('acm-update-check', 'weekly');
  render(<UpdatePreference />);

  expect(screen.getByRole('radio', { name: 'Check on launch' })).toHaveProperty('checked', true);
});
