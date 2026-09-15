import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { ThemePicker } from './ThemePicker';

test('offers every mode and marks the active one', () => {
  render(<ThemePicker mode="dark" onChange={vi.fn()} />);

  for (const label of ['Light', 'Dark', 'Match system']) {
    expect(screen.getByRole('radio', { name: label })).toBeDefined();
  }

  expect(screen.getByRole('radio', { name: 'Dark' })).toHaveProperty('checked', true);
  expect(screen.getByRole('radio', { name: 'Light' })).toHaveProperty('checked', false);
});

test('sets the chosen mode', async () => {
  const onChange = vi.fn();

  render(<ThemePicker mode="system" onChange={onChange} />);
  await userEvent.click(screen.getByRole('radio', { name: 'Light' }));

  expect(onChange).toHaveBeenCalledWith('light');
});

test('shows every mode without being opened', () => {
  render(<ThemePicker mode="light" onChange={vi.fn()} />);

  expect(screen.getAllByRole('radio')).toHaveLength(3);
});
