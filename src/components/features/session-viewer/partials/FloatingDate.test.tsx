import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { FloatingDate } from './FloatingDate';

const NOW = Date.parse('2026-08-28T12:00:00Z');

test('names the day being scrolled through', () => {
  render(<FloatingDate timestampMs={NOW - 26 * 3_600_000} nowMs={NOW} />);

  expect(screen.getByText('yesterday')).toBeDefined();
});

test('floats nothing while a separator is already on screen', () => {
  render(<FloatingDate timestampMs={0} nowMs={NOW} />);

  expect(document.querySelector('[data-floating-date]')).toBeNull();
});
