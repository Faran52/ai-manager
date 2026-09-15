import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { DividerLabel } from './DividerLabel';

test('names the break it draws, for a screen reader as well as the eye', () => {
  render(<DividerLabel label="today" />);

  expect(screen.getByRole('separator', { name: 'today' })).toBeDefined();
  expect(screen.getByText('today')).toBeDefined();
});
