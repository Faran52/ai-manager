import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { ActivityTimeline } from './ActivityTimeline';

test('draws a bar per day with its own label', () => {
  render(
    <ActivityTimeline
      days={[
        {
          date: '2026-08-26',
          sessions: 2,
          intensity: 1,
        },
        {
          date: '2026-08-27',
          sessions: 1,
          intensity: 0.5,
        },
      ]}
    />,
  );

  expect(screen.getByText('Sessions per day')).toBeDefined();
  expect(screen.getByLabelText('2026-08-26, 2 sessions')).toBeDefined();
  expect(screen.getByLabelText('2026-08-27, 1 session')).toBeDefined();
  expect(screen.getByText('2026-08-26')).toBeDefined();
  expect(screen.getByText('2026-08-27')).toBeDefined();
});

test('draws nothing without days', () => {
  render(<ActivityTimeline days={[]} />);

  expect(screen.queryByText('Sessions per day')).toBeNull();
});
