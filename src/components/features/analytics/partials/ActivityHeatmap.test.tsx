import { render, screen } from '@testing-library/react';
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
    expect(cells).toHaveLength(9 * 7);
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

describe('ActivityHeatmap reference points', () => {
  test('names the weekdays and the months the grid spans', () => {
    render(<ActivityHeatmap activity={[]} />);

    const labels = [...document.querySelectorAll('[data-activity-heatmap] span')]
      .map((span) => {
        return span.textContent.trim();
      })
      .filter((text) => {
        return text.length > 0;
      });

    expect(labels).toContain('Mon');
    expect(labels).toContain('Wed');
    expect(labels).toContain('Fri');
    expect(labels.filter((text) => {
      return /^[A-Z][a-z]{2}$/u.test(text) && !['Mon', 'Wed', 'Fri'].includes(text);
    }).length).toBeGreaterThan(1);
  });

  test('says which end of the scale is which', () => {
    render(<ActivityHeatmap activity={[]} />);

    expect(screen.getByText('Less')).toBeDefined();
    expect(screen.getByText('More')).toBeDefined();
  });
});
