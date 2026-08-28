import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { StatusBadge } from './StatusBadge';

test('marks a call still waiting on its result', () => {
  render(<StatusBadge status="ok" pending />);

  expect(screen.getByText('Pending')).toBeDefined();
  expect(document.querySelector('[data-status-badge="pending"]')).not.toBeNull();
});

test('marks each finished state with its own tone', () => {
  const { rerender } = render(<StatusBadge status="ok" pending={false} />);

  expect(screen.getByText('OK')).toBeDefined();

  rerender(<StatusBadge status="error" pending={false} />);
  expect(screen.getByText('Error')).toBeDefined();
  expect(document.querySelector('[data-status-badge="error"]')).not.toBeNull();

  rerender(<StatusBadge status="interrupted" pending={false} />);
  expect(screen.getByText('Interrupted')).toBeDefined();
});
