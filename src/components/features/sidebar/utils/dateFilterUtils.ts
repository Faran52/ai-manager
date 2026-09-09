export type DateFilter = 'all' | 'today' | 'week' | 'month' | 'quarter';

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGE_DAYS: Record<Exclude<DateFilter, 'all' | 'today'>, number> = {
  week: 7,
  month: 30,
  quarter: 90,
};

// The i18n key each choice reads under, shared by the funnel menu.
export const DATE_FILTER_LABEL: Record<DateFilter, string> = {
  all: 'dateAllTime',
  today: 'dateToday',
  week: 'dateLast7',
  month: 'dateLast30',
  quarter: 'dateLast90',
};

export const DATE_FILTERS: readonly DateFilter[] = ['all', 'today', 'week', 'month', 'quarter'];

// True when a timestamp falls inside the chosen window. "today" is the calendar
// day; the rest are rolling windows counted back from now.
export const withinDateFilter = (
  timestampMs: number,
  filter: DateFilter,
  nowMs: number,
): boolean => {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'today') {
    return timestampMs >= new Date(nowMs).setHours(0, 0, 0, 0);
  }

  return timestampMs >= nowMs - RANGE_DAYS[filter] * DAY_MS;
};
