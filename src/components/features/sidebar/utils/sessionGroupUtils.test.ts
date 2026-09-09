import { groupSessionsByRecency, recencyBucket } from './sessionGroupUtils';

const NOW = Date.parse('2026-08-28T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const row = (offsetMs: number, continuation = false) => {
  return {
    session: { lastTimestampMs: NOW - offsetMs },
    continuation,
  };
};

describe('recencyBucket', () => {
  test('sorts a timestamp into today, this week, or earlier', () => {
    expect(recencyBucket(NOW - 1000, NOW)).toBe('today');
    expect(recencyBucket(NOW - 3 * DAY, NOW)).toBe('week');
    expect(recencyBucket(NOW - 30 * DAY, NOW)).toBe('earlier');
  });

  test('keeps this week and today from overlapping', () => {
    const startOfToday = new Date(NOW).setHours(0, 0, 0, 0);

    expect(recencyBucket(startOfToday, NOW)).toBe('today');
    expect(recencyBucket(startOfToday - 1, NOW)).toBe('week');
  });
});

describe('groupSessionsByRecency', () => {
  test('splits rows into buckets in the order they first appear', () => {
    const groups = groupSessionsByRecency([row(0), row(2 * DAY), row(40 * DAY)], NOW);

    expect(groups.map((group) => {
      return group.bucket;
    })).toEqual(['today', 'week', 'earlier']);
    expect(groups.every((group) => {
      return group.rows.length === 1 && group.count === 1;
    })).toBe(true);
  });

  test('counts threads rather than rows, and keeps a continuation with its head', () => {
    const groups = groupSessionsByRecency([row(0), row(40 * DAY, true), row(0)], NOW);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.bucket).toBe('today');
    expect(groups[0]?.rows).toHaveLength(3);
    expect(groups[0]?.count).toBe(2);
  });

  test('has no groups for an empty list', () => {
    expect(groupSessionsByRecency([], NOW)).toEqual([]);
  });
});
