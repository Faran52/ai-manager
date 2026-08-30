export interface HeatmapDay {
  readonly date: string;
  readonly tokens: number;
  readonly messages: number;
}

export interface HeatmapWeek {
  readonly key: string;
  // Monday first, so a column is one week read top to bottom.
  readonly days: readonly HeatmapDay[];
  // Set on the first week of a month, which is where its name is written.
  readonly month?: string | undefined;
}

export const IDLE_CLASS = 'bg-muted';

// Buckets a day's token total against the week's peak into 0–3 intensity levels.
export const levelFor = (tokens: number, peak: number): number => {
  if (tokens <= 0 || peak === 0) {
    return 0;
  }

  if (tokens < peak * 0.25) {
    return 1;
  }

  return tokens < peak * 0.6 ? 2 : 3;
};

export const levelClass = (tokens: number, peak: number): string => {
  switch (levelFor(tokens, peak)) {
    case 1:
      return 'bg-ok/40';
    case 2:
      return 'bg-ok/70';
    case 3:
      return 'bg-ok';
    default:
      return IDLE_CLASS;
  }
};

export const WEEKS_SHOWN = 26;
const DAYS_IN_WEEK = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isoOf = (day: Date): string => {
  return day.toISOString().slice(0, 10);
};

/**
 * Lays the last half year out as weeks, because a flat run of squares gives the
 * reader nothing to measure against: no way to see which day of the week a
 * square is, and no way to see where one month ends and the next begins.
 *
 * Columns are weeks and rows are weekdays, so a habit shows up as a row and a
 * busy fortnight as neighbouring columns. The grid always ends on today.
 */
export const weeksTo = (
  activity: readonly { readonly date: string;
    readonly tokens: number;
    readonly messages: number; }[],
  todayMs: number,
): readonly HeatmapWeek[] => {
  const byDate = new Map(activity.map((day) => {
    return [day.date, day];
  }));
  const today = new Date(todayMs);
  // Monday of the current week, so the last column is the one in progress.
  const intoWeek = (today.getUTCDay() + 6) % DAYS_IN_WEEK;
  const lastMonday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() - intoWeek,
  );
  const weeks: HeatmapWeek[] = [];

  for (let week = WEEKS_SHOWN - 1; week >= 0; week -= 1) {
    const startMs = lastMonday - week * DAYS_IN_WEEK * MS_PER_DAY;
    const days = Array.from({ length: DAYS_IN_WEEK }, (_unused, weekday) => {
      const date = isoOf(new Date(startMs + weekday * MS_PER_DAY));
      const found = byDate.get(date);

      return {
        date,
        tokens: found?.tokens ?? 0,
        messages: found?.messages ?? 0,
      };
    });
    const start = new Date(startMs);
    const previous = new Date(startMs - DAYS_IN_WEEK * MS_PER_DAY);

    weeks.push({
      key: isoOf(start),
      days,
      ...start.getUTCMonth() === previous.getUTCMonth()
        ? {}
        : {
            month: start.toLocaleDateString('en-US', {
              month: 'short',
              timeZone: 'UTC',
            }),
          },
    });
  }

  return weeks;
};
