import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { DateDivider } from './DateDivider';

const NOW = Date.parse('2026-08-28T12:00:00Z');

test('names today and yesterday rather than dating them', () => {
  const { rerender } = render(<DateDivider timestampMs={NOW - 3_600_000} nowMs={NOW} />);

  expect(screen.getByRole('separator', { name: 'today' })).toBeDefined();

  rerender(<DateDivider timestampMs={NOW - 26 * 3_600_000} nowMs={NOW} />);
  expect(screen.getByRole('separator', { name: 'yesterday' })).toBeDefined();
});

test('writes out any older day in full', () => {
  render(<DateDivider timestampMs={Date.parse('2026-06-27T10:00:00Z')} nowMs={NOW} />);

  expect(screen.getByRole('separator', { name: /June 27, 2026/ })).toBeDefined();
});
