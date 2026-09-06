import {
  fireEvent,
  render,
  screen,
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
  document.documentElement.style.removeProperty('--primary');
});

test('offers every accent and marks the active one', () => {
  localStorage.setItem('acm-accent', 'iris');
  render(<AccentPicker />);

  for (const label of ['Teal', 'Iris', 'Amber', 'Rose', 'Lime', 'Sky']) {
    expect(screen.getByRole('button', { name: label })).toBeDefined();
  }

  expect(screen.getByRole('button', { name: 'Iris' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Teal' }).getAttribute('aria-pressed')).toBe('false');
});

test('applies and persists a chosen accent', async () => {
  render(<AccentPicker />);
  await userEvent.click(screen.getByRole('button', { name: 'Rose' }));

  expect(localStorage.getItem('acm-accent')).toBe('rose');
  expect(document.documentElement.dataset.accent).toBe('rose');
});

/*
 * A custom colour has no [data-accent] rule to hit, so it has to ride an inline
 * --primary. That is the half of this control the six swatches never exercise.
 */
test('takes a custom colour from the system picker', () => {
  render(<AccentPicker />);
  fireEvent.change(screen.getByLabelText('Custom colour'), { target: { value: '#ff8800' } });

  expect(localStorage.getItem('acm-accent')).toBe('#ff8800');
  expect(document.documentElement.dataset.accent).toBe('custom');
  expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#ff8800');
});

test('drops the custom colour again when a named accent is chosen', async () => {
  localStorage.setItem('acm-accent', '#ff8800');
  render(<AccentPicker />);
  await userEvent.click(screen.getByRole('button', { name: 'Lime' }));

  expect(document.documentElement.style.getPropertyValue('--primary')).toBe('');
  expect(document.documentElement.dataset.accent).toBe('lime');
});
