import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { reducedMotion } from '@mocks/reducedMotionFixtures';

import { SegmentedControl } from './SegmentedControl';

afterEach(() => {
  vi.unstubAllGlobals();
});

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
  reducedMotion(false);
  control();

  expect(screen.getByRole('radio', { name: 'Dark' })).toHaveProperty('checked', true);
  expect(screen.getByRole('radio', { name: 'Light' })).toHaveProperty('checked', false);
});

test('renders the selected fill without motion for a reduced-motion reader', () => {
  reducedMotion(true);
  control();

  expect(screen.getByRole('radio', { name: 'Dark' })).toHaveProperty('checked', true);
});

test('reports the chosen value', async () => {
  const onChange = vi.fn();

  control(onChange);
  await userEvent.click(screen.getByRole('radio', { name: 'System' }));

  expect(onChange).toHaveBeenCalledWith('system');
});

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
