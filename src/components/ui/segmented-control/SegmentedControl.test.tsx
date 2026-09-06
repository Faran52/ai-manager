import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { SegmentedControl } from './SegmentedControl';

const OPTIONS = [
  {
    value: 'light',
    label: 'Light',
  },
  {
    value: 'dark',
    label: 'Dark',
  },
  {
    value: 'system',
    label: 'System',
  },
];

const control = (onChange = vi.fn(), value = 'dark'): void => {
  render(<SegmentedControl label="Theme" options={OPTIONS} value={value} onChange={onChange} />);
};

test('marks only the value in force', () => {
  control();

  expect(screen.getByRole('radio', { name: 'Dark' })).toHaveProperty('checked', true);
  expect(screen.getByRole('radio', { name: 'Light' })).toHaveProperty('checked', false);
});

test('reports the chosen value', async () => {
  const onChange = vi.fn();

  control(onChange);
  await userEvent.click(screen.getByRole('radio', { name: 'System' }));

  expect(onChange).toHaveBeenCalledWith('system');
});

/*
 * The reason for native radios over a hand-rolled group: the browser already
 * answers the arrow keys and keeps one tab stop for the whole set.
 */
test('moves between segments with the arrow keys', async () => {
  const onChange = vi.fn();

  control(onChange);
  await userEvent.tab();

  expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Dark' }));

  await userEvent.keyboard('{ArrowRight}');

  expect(onChange).toHaveBeenCalledWith('system');
});

test('keeps two controls on one pane apart', () => {
  render(
    <>
      <SegmentedControl label="Theme" options={OPTIONS} value="dark" onChange={vi.fn()} />
      <SegmentedControl label="Size" options={OPTIONS} value="light" onChange={vi.fn()} />
    </>,
  );

  const groups = new Set(screen.getAllByRole('radio').map((radio) => {
    return radio.getAttribute('name');
  }));

  expect(groups.size).toBe(2);
});
