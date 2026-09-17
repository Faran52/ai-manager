import {
  DAYS_IN_WEEK,
  MS_PER_DAY,
  WASH_SCALE,
  WEEKS_SHOWN,
} from '../constants';

export interface HeatmapDay {
  readonly date: string;
  readonly tokens: number;
  readonly messages: number;
}

export interface HeatmapMonth {
  readonly key: string;
  readonly label: string;
  readonly weeks: readonly HeatmapWeek[];
}

export interface HeatmapWeek {
  readonly key: string;
  // Monday first, so a column is one week read top to bottom.
  readonly days: readonly HeatmapDay[];
  // Set on the first week of a month, which is where its name is written.
  readonly month?: string | undefined;
}

export interface HeatmapActivity {
  readonly date: string;
  readonly tokens: number;
  readonly messages: number;
}

export const levelFor = (tokens: number, peak: number): 0 | 1 | 2 | 3 => {
  if (tokens <= 0 || peak === 0) {
    return 0;
  }

  if (tokens < peak * 0.25) {
    return 1;
  }

  return tokens < peak * 0.6 ? 2 : 3;
};

export const levelClass = (tokens: number, peak: number): string => {
  return WASH_SCALE[levelFor(tokens, peak)];
};

const isoOf = (day: Date): string => {
  return day.toISOString().slice(0, 10);
};

// Columns are weeks and rows are weekdays, so a habit shows up as a row and a
// busy fortnight as neighbouring columns. A flat run of squares shows neither.
export const weeksTo = (
  activity: readonly HeatmapActivity[],
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
    // The opening column is always named: the window starts mid-month, and an
    // unnamed block of days at the front says nothing about when it is.
    const opens = week === WEEKS_SHOWN - 1;

    weeks.push({
      key: isoOf(start),
      days,
      ...!opens && start.getUTCMonth() === previous.getUTCMonth()
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

// A week is filed under the month its Monday falls in, the same rule that
// decides where the name is written. Ungrouped, the names had nothing to sit on.
export const monthsOf = (weeks: readonly HeatmapWeek[]): readonly HeatmapMonth[] => {
  const months: HeatmapMonth[] = [];

  for (const week of weeks) {
    const current = months.at(-1);

    if (current == null || week.month != null) {
      months.push({
        key: week.key,
        /* v8 ignore next -- a group only ever starts on a week that names its month */
        label: week.month ?? '',
        weeks: [week],
      });
      continue;
    }

    months[months.length - 1] = {
      ...current,
      weeks: [...current.weeks, week],
    };
  }

  return months;
};
