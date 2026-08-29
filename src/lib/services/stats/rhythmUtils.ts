import { DAYS_IN_WEEK, HOURS_IN_DAY } from './aggregateUtils';

import type { DayActivity } from './aggregateUtils';

export interface StatsRhythm {
  // Turns per local hour of day, and per weekday with Monday first.
  readonly hours: readonly number[];
  readonly weekdays: readonly number[];
  readonly peakHour?: number | undefined;
  readonly activeDays: number;
  readonly spanDays: number;
  readonly currentStreak: number;
  readonly longestStreak: number;
}

export interface StatsEffort {
  readonly userMessages: number;
  readonly userChars: number;
  readonly userWords: number;
  readonly codeEdits: number;
  readonly commandsRun: number;
  readonly searches: number;
  readonly webActions: number;
}

interface Streaks {
  readonly current: number;
  readonly longest: number;
}

type Bucket = 'codeEdits' | 'commandsRun' | 'searches' | 'webActions';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A rough proxy: characters per word, close enough to compare months against
// each other without pretending to tokenise prose.
const CHARS_PER_WORD = 5;

const histogram = (counts: ReadonlyMap<number, number>, slots: number): readonly number[] => {
  return Array.from({ length: slots }, (_unused, slot) => {
    return counts.get(slot) ?? 0;
  });
};

const busiestSlot = (counts: readonly number[]): number | undefined => {
  let peak: number | undefined;
  let best = 0;

  for (const [slot, count] of counts.entries()) {
    if (count > best) {
      best = count;
      peak = slot;
    }
  }

  return peak;
};

const dayNumber = (date: string): number => {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY);
};

/**
 * A streak is consecutive calendar days with any activity. The current one only
 * counts if it reaches today or yesterday: a run that ended last month is
 * history, not a streak the reader is still on.
 */
const streaksOf = (days: readonly number[], todayNumber: number): Streaks => {
  let longest = 0;
  let run = 0;
  let previous: number | undefined;

  for (const day of days) {
    run = previous != null && day - previous === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  const last = days.at(-1);
  const live = last != null && todayNumber - last <= 1;

  return {
    current: live ? run : 0,
    longest,
  };
};

export const rhythmFrom = (
  activity: readonly DayActivity[],
  hours: ReadonlyMap<number, number>,
  weekdays: ReadonlyMap<number, number>,
  nowMs: number,
): StatsRhythm => {
  const hourCounts = histogram(hours, HOURS_IN_DAY);
  const numbers = activity.map((day) => {
    return dayNumber(day.date);
  }).filter((day) => {
    return Number.isFinite(day);
  }).sort((left, right) => {
    return left - right;
  });
  const first = numbers[0];
  const last = numbers.at(-1);
  const streaks = streaksOf(numbers, Math.floor(nowMs / MS_PER_DAY));

  return {
    hours: hourCounts,
    weekdays: histogram(weekdays, DAYS_IN_WEEK),
    peakHour: busiestSlot(hourCounts),
    activeDays: numbers.length,
    spanDays: first == null || last == null ? 0 : last - first + 1,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
  };
};

/**
 * Every agent names its tools differently, so the buckets match on the words
 * they have in common. A tool that matches nothing is still counted in the tool
 * histogram; it simply has no activity bucket of its own.
 */
const BUCKET_MARKERS: readonly (readonly [Bucket, readonly string[]])[] = [
  ['codeEdits', ['edit', 'write', 'patch', 'replace', 'create_file', 'apply']],
  ['commandsRun', ['bash', 'shell', 'exec', 'terminal', 'command', 'run']],
  ['searches', ['grep', 'search', 'glob', 'find']],
  ['webActions', ['web', 'fetch', 'browser', 'url', 'http']],
];

const bucketOf = (tool: string): Bucket | undefined => {
  const name = tool.toLowerCase();

  return BUCKET_MARKERS.find(([, markers]) => {
    return markers.some((marker) => {
      return name.includes(marker);
    });
  })?.[0];
};

export const effortFrom = (
  tools: ReadonlyMap<string, number>,
  userMessages: number,
  userChars: number,
): StatsEffort => {
  const buckets: Record<Bucket, number> = {
    codeEdits: 0,
    commandsRun: 0,
    searches: 0,
    webActions: 0,
  };

  for (const [tool, count] of tools) {
    const bucket = bucketOf(tool);

    if (bucket != null) {
      buckets[bucket] += count;
    }
  }

  return {
    ...buckets,
    userMessages,
    userChars,
    userWords: Math.round(userChars / CHARS_PER_WORD),
  };
};
