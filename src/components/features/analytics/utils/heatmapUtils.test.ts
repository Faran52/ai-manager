import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  IDLE_CLASS,
  levelClass,
  levelFor,
  WEEKS_SHOWN,
  weeksTo,
} from './heatmapUtils';

describe('levelFor', () => {
  test('is idle without tokens or a peak', () => {
    expect(levelFor(0, 100)).toBe(0);
    expect(levelFor(50, 0)).toBe(0);
  });

  test('buckets against quarter and sixty percent of the peak', () => {
    expect(levelFor(24, 100)).toBe(1);
    expect(levelFor(25, 100)).toBe(2);
    expect(levelFor(59, 100)).toBe(2);
    expect(levelFor(60, 100)).toBe(3);
  });
});

describe('levelClass', () => {
  test('maps each level to its wash', () => {
    expect(levelClass(0, 100)).toBe(IDLE_CLASS);
    expect(levelClass(10, 100)).toBe('bg-ok/40');
    expect(levelClass(30, 100)).toBe('bg-ok/70');
    expect(levelClass(90, 100)).toBe('bg-ok');
  });
});

describe('weeksTo', () => {
  const FRIDAY = Date.parse('2026-08-28T12:00:00Z');

  test('lays the span out as whole weeks that end on the current one', () => {
    const weeks = weeksTo([], FRIDAY);
    const last = weeks.at(-1);

    expect(weeks).toHaveLength(WEEKS_SHOWN);
    expect(weeks.every((week) => {
      return week.days.length === 7;
    })).toBe(true);
    expect(last?.days[0]?.date).toBe('2026-08-24');
    expect(last?.days.at(-1)?.date).toBe('2026-08-30');
  });

  test('starts every column on a Monday', () => {
    expect(weeksTo([], FRIDAY).every((week) => {
      return new Date(`${String(week.days[0]?.date)}T00:00:00Z`).getUTCDay() === 1;
    })).toBe(true);
  });

  test('names a month on the first week that reaches it and no other', () => {
    const named = weeksTo([], FRIDAY).filter((week) => {
      return week.month != null;
    });

    expect(named.length).toBeGreaterThan(1);
    expect(new Set(named.map((week) => {
      return week.month;
    })).size).toBe(named.length);
  });

  test('carries a day its own totals and leaves the rest empty', () => {
    const weeks = weeksTo([{
      date: '2026-08-26',
      tokens: 900,
      messages: 4,
    }], FRIDAY);
    const days = weeks.flatMap((week) => {
      return week.days;
    });
    const busy = days.find((day) => {
      return day.date === '2026-08-26';
    });

    expect(busy?.tokens).toBe(900);
    expect(busy?.messages).toBe(4);
    expect(days.filter((day) => {
      return day.tokens > 0;
    })).toHaveLength(1);
  });
});
