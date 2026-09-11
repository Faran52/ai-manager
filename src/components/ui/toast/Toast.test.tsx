import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { Toast } from './Toast';

test('shows its own text', () => {
  render(<Toast text="Saved" variant="info" onClose={vi.fn()} />);

  expect(screen.getByText('Saved')).toBeDefined();
});

test('marks the surface with the variant it was given', () => {
  render(<Toast text="Could not save" variant="error" onClose={vi.fn()} />);

  expect(document.querySelector('[data-toast][data-variant="error"]')).not.toBeNull();
});

test('closes on request', async () => {
  const onClose = vi.fn();

  render(<Toast text="Heads up" variant="warning" onClose={onClose} />);

  await userEvent.click(screen.getByRole('button', { name: 'Close notification' }));

  expect(onClose).toHaveBeenCalledTimes(1);
});
