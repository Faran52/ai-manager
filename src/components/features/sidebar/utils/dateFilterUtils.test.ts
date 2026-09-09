import { DATE_FILTERS, withinDateFilter } from './dateFilterUtils';

const NOW = Date.parse('2026-08-28T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('withinDateFilter', () => {
  test('all time keeps everything, however old', () => {
    expect(withinDateFilter(0, 'all', NOW)).toBe(true);
  });

  test('today is the calendar day, not the last 24 hours', () => {
    const startOfToday = new Date(NOW).setHours(0, 0, 0, 0);

    expect(withinDateFilter(startOfToday, 'today', NOW)).toBe(true);
    expect(withinDateFilter(startOfToday - 1, 'today', NOW)).toBe(false);
  });

  test('the rest are rolling windows back from now', () => {
    expect(withinDateFilter(NOW - 6 * DAY, 'week', NOW)).toBe(true);
    expect(withinDateFilter(NOW - 8 * DAY, 'week', NOW)).toBe(false);
    expect(withinDateFilter(NOW - 25 * DAY, 'month', NOW)).toBe(true);
    expect(withinDateFilter(NOW - 80 * DAY, 'month', NOW)).toBe(false);
    expect(withinDateFilter(NOW - 80 * DAY, 'quarter', NOW)).toBe(true);
  });

  test('lists every choice the funnel offers', () => {
    expect(DATE_FILTERS).toEqual(['all', 'today', 'week', 'month', 'quarter']);
  });
});
