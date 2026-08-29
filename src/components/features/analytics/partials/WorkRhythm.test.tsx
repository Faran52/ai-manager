import { render, screen } from '@testing-library/react';

import { WorkRhythm } from './WorkRhythm';

import type { StatsEffort, StatsRhythm } from '@services/stats/statsService';

const rhythm = (overrides: Partial<StatsRhythm> = {}): StatsRhythm => {
  return {
    hours: Array.from({ length: 24 }, (_unused, hour) => {
      return hour === 14 ? 40 : 0;
    }),
    weekdays: [5, 4, 3, 2, 1, 0, 0],
    peakHour: 14,
    activeDays: 12,
    spanDays: 30,
    currentStreak: 3,
    longestStreak: 8,
    ...overrides,
  };
};

const effort = (overrides: Partial<StatsEffort> = {}): StatsEffort => {
  return {
    userMessages: 120,
    userChars: 6_000,
    userWords: 1_200,
    codeEdits: 44,
    commandsRun: 33,
    searches: 22,
    webActions: 11,
    ...overrides,
  };
};

test('shows when the work happens and how much of it was typed', () => {
  render(<WorkRhythm rhythm={rhythm()} effort={effort()} />);

  expect(screen.getByText('14:00')).toBeDefined();
  expect(screen.getByText('3 days')).toBeDefined();
  expect(screen.getByText('8 days')).toBeDefined();
  expect(screen.getByText('12 of 30')).toBeDefined();
  expect(screen.getByText('1.2k')).toBeDefined();
  expect(document.querySelector('[data-rhythm-bar="weekdayMon"]')?.getAttribute('title'))
    .toBe('Mon: 5');
});

test('scales the busiest hour to the full height of the strip', () => {
  render(<WorkRhythm rhythm={rhythm()} effort={effort()} />);

  const busiest = document.querySelector('[data-rhythm-bar="14"]');
  const quiet = document.querySelector('[data-rhythm-bar="0"]');

  expect(busiest?.getAttribute('style')).toContain('height: 100%');
  expect(quiet?.getAttribute('style')).toContain('height: 0%');
});

test('says nothing about a peak hour before anything has been recorded', () => {
  render(
    <WorkRhythm
      rhythm={rhythm({
        hours: [],
        weekdays: [],
        peakHour: undefined,
        activeDays: 0,
        spanDays: 0,
        currentStreak: 0,
        longestStreak: 0,
      })}
      effort={effort()}
    />,
  );

  expect(screen.getByText('Not recorded')).toBeDefined();
  expect(document.querySelector('[data-rhythm-bar="weekdayMon"]')?.getAttribute('style'))
    .toContain('height: 0%');
});
