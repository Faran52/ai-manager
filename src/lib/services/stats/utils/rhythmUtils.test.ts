import {
  describe,
  expect,
  test,
} from 'vitest';

import { effortFrom, rhythmFrom } from './rhythmUtils';

import type { DayActivity } from './aggregateUtils';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const day = (date: string): DayActivity => {
  return {
    date,
    messages: 1,
    tokens: 1,
  };
};

const today = Date.parse('2026-08-29T12:00:00Z');
const daysAgo = (count: number): string => {
  return new Date(today - count * MS_PER_DAY).toISOString().slice(0, 10);
};

describe('rhythmFrom', () => {
  test('spreads the counts it was given over full days and weeks', () => {
    const rhythm = rhythmFrom([day('2026-08-29')], new Map([[9, 4], [21, 7]]), new Map([[2, 3]]), today);

    expect(rhythm.hours).toHaveLength(24);
    expect(rhythm.hours[9]).toBe(4);
    expect(rhythm.hours[21]).toBe(7);
    expect(rhythm.hours[0]).toBe(0);
    expect(rhythm.weekdays).toEqual([0, 0, 3, 0, 0, 0, 0]);
    expect(rhythm.peakHour).toBe(21);
  });

  test('names no peak hour when nothing was recorded', () => {
    const rhythm = rhythmFrom([], new Map(), new Map(), today);

    expect(rhythm.peakHour).toBeUndefined();
    expect(rhythm.activeDays).toBe(0);
    expect(rhythm.spanDays).toBe(0);
    expect(rhythm.currentStreak).toBe(0);
    expect(rhythm.longestStreak).toBe(0);
  });

  test('counts consecutive days as one streak and measures the whole span', () => {
    const rhythm = rhythmFrom([
      day(daysAgo(20)),
      day(daysAgo(2)),
      day(daysAgo(1)),
      day(daysAgo(0)),
    ], new Map(), new Map(), today);

    expect(rhythm.activeDays).toBe(4);
    expect(rhythm.spanDays).toBe(21);
    expect(rhythm.currentStreak).toBe(3);
    expect(rhythm.longestStreak).toBe(3);
  });

  test('keeps a streak alive when the last day was yesterday', () => {
    const rhythm = rhythmFrom([day(daysAgo(2)), day(daysAgo(1))], new Map(), new Map(), today);

    expect(rhythm.currentStreak).toBe(2);
  });

  test('reports no current streak once the run has been broken', () => {
    const rhythm = rhythmFrom([day(daysAgo(9)), day(daysAgo(8))], new Map(), new Map(), today);

    expect(rhythm.currentStreak).toBe(0);
    expect(rhythm.longestStreak).toBe(2);
  });

  test('keeps the longest run when a later one is shorter', () => {
    const rhythm = rhythmFrom([
      day(daysAgo(30)),
      day(daysAgo(29)),
      day(daysAgo(28)),
      day(daysAgo(10)),
    ], new Map(), new Map(), today);

    expect(rhythm.longestStreak).toBe(3);
    expect(rhythm.currentStreak).toBe(0);
  });

  test('ignores a day whose date cannot be read', () => {
    const rhythm = rhythmFrom([day('not-a-day'), day('2026-08-29')], new Map(), new Map(), today);

    expect(rhythm.activeDays).toBe(1);
  });
});

describe('effortFrom', () => {
  test('sorts tools into the kind of work they do', () => {
    const effort = effortFrom(new Map([
      ['Edit', 4],
      ['apply_patch', 2],
      ['Bash', 5],
      ['Grep', 3],
      ['WebFetch', 1],
      ['TodoWrite', 7],
    ]), 10, 500);

    expect(effort.codeEdits).toBe(13);
    expect(effort.commandsRun).toBe(5);
    expect(effort.searches).toBe(3);
    expect(effort.webActions).toBe(1);
  });

  test('leaves a tool it cannot place out of every bucket', () => {
    const effort = effortFrom(new Map([['Think', 9]]), 0, 0);

    expect(effort.codeEdits).toBe(0);
    expect(effort.commandsRun).toBe(0);
    expect(effort.searches).toBe(0);
    expect(effort.webActions).toBe(0);
  });

  test('reports what the person typed as words as well as characters', () => {
    const effort = effortFrom(new Map(), 12, 1_000);

    expect(effort.userMessages).toBe(12);
    expect(effort.userChars).toBe(1_000);
    expect(effort.userWords).toBe(200);
  });
});
