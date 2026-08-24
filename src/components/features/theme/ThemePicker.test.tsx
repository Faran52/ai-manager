import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { ThemePicker } from './ThemePicker';

test('offers every mode and marks the active one', async () => {
  render(<ThemePicker mode="dark" onChange={vi.fn()} />);
  await userEvent.click(screen.getByTitle('Theme: Dark'));

  for (const label of ['Light', 'Dark', 'Match system']) {
    expect(screen.getByText(label)).toBeDefined();
  }

  expect(screen.getByText('Dark').parentElement?.querySelector('svg')).not.toBeNull();
});

test('sets the chosen mode and closes', async () => {
  const onChange = vi.fn();

  render(<ThemePicker mode="system" onChange={onChange} />);
  await userEvent.click(screen.getByTitle('Theme: Match system'));
  await userEvent.click(screen.getByText('Light'));

  expect(onChange).toHaveBeenCalledWith('light');
  await waitFor(() => {
    expect(screen.queryByText('Match system')).toBeNull();
  });
});

test('dismisses without changing the mode', async () => {
  const onChange = vi.fn();

  render(<ThemePicker mode="light" onChange={onChange} />);
  await userEvent.click(screen.getByTitle('Theme: Light'));
  await userEvent.keyboard('{Escape}');

  await waitFor(() => {
    expect(screen.queryByText('Match system')).toBeNull();
  });
  expect(onChange).not.toHaveBeenCalled();
});
