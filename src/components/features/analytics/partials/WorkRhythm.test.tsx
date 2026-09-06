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
  // Weekdays are ranked rows now, not a second column chart.
  expect(document.querySelector('[data-bar-row="Mon"]')).not.toBeNull();
  expect(document.querySelector('[data-bar-row="Mon"] [data-bar-fill]')
    ?.getAttribute('data-bar-fill')).toBe('100');
});

test('scales the busiest hour to the full height of the strip', () => {
  render(<WorkRhythm rhythm={rhythm()} effort={effort()} />);

  const busiest = document.querySelector('[data-rhythm-bar="14"]');
  const quiet = document.querySelector('[data-rhythm-bar="0"]');

  expect(busiest?.getAttribute('data-rhythm-height')).toBe('100');
  expect(quiet?.getAttribute('data-rhythm-height')).toBe('0');
  // The peak is marked so the reader is not left counting along the row.
  expect(busiest?.getAttribute('data-rhythm-peak')).toBe('true');
  expect(quiet?.getAttribute('data-rhythm-peak')).toBeNull();
});

/*
 * An hour with nothing recorded keeps a hairline rather than disappearing, so
 * "quiet" and "nothing" stop looking alike.
 */
test('keeps an empty hour visible on the baseline', () => {
  render(<WorkRhythm rhythm={rhythm()} effort={effort()} />);

  const quiet = document.querySelector('[data-rhythm-bar="0"]');

  expect(quiet?.getAttribute('style')).toContain('2px');
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
  expect(document.querySelector('[data-bar-row="Mon"] [data-bar-fill]')
    ?.getAttribute('data-bar-fill')).toBe('0');
});

/*
 * A day of recorded sessions that happen to hold no tokens still draws 24
 * slots, and dividing by a peak of zero would put NaN into every height.
 */
test('draws a strip of recorded hours that all hold nothing', () => {
  render(
    <WorkRhythm
      rhythm={rhythm({
        hours: Array.from({ length: 24 }, () => {
          return 0;
        }),
      })}
      effort={effort()}
    />,
  );

  const first = document.querySelector('[data-rhythm-bar="0"]');

  expect(first?.getAttribute('data-rhythm-height')).toBe('0');
  expect(first?.getAttribute('data-rhythm-peak')).toBeNull();
});
