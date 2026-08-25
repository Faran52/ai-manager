import { render } from '@testing-library/react';
import {
  describe,
  expect,
  test,
} from 'vitest';

import { ActivityHeatmap } from './ActivityHeatmap';

import type { DayActivity } from '@services/stats/statsService';

describe('ActivityHeatmap', () => {
  test('maps token volume onto four intensity levels', () => {
    const today = new Date();
    const day = (offset: number, tokens: number): DayActivity => {
      const date = new Date(today);

      date.setUTCDate(date.getUTCDate() - offset);

      return {
        date: date.toISOString().slice(0, 10),
        messages: 1,
        tokens,
      };
    };

    render(
      <ActivityHeatmap
        activity={[day(1, 400), day(2, 200), day(3, 50), day(4, 10), day(5, 0)]}
      />,
    );

    const cells = document.querySelectorAll('[data-activity-heatmap] span[data-level]');
    const levels = new Map([...cells].map((cell) => {
      return [cell.getAttribute('data-level'), true];
    }));

    for (const level of ['0', '1', '2', '3']) {
      expect(levels.has(level)).toBe(true);
    }
    expect(cells).toHaveLength(26 * 7);
  });
});

describe('ActivityHeatmap idle grid', () => {
  test('renders an all-idle grid without activity', () => {
    render(<ActivityHeatmap activity={[]} />);

    const cells = document.querySelectorAll('[data-activity-heatmap] span[data-level]');

    expect(cells.length).toBeGreaterThan(0);
    expect([...cells].every((cell) => {
      return cell.getAttribute('data-level') === '0';
    })).toBe(true);
  });
});
