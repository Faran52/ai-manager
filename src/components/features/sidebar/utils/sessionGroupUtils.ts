export type RecencyBucket = 'today' | 'week' | 'earlier';

export interface RecencyGroup<T> {
  readonly bucket: RecencyBucket;
  readonly rows: readonly T[];
  // Threads, not rows: an expanded thread's continuation rows are not counted.
  readonly count: number;
}

interface GroupableSession {
  readonly lastTimestampMs: number;
}

interface GroupableRow {
  readonly session: GroupableSession;
  readonly continuation: boolean;
}

interface MutableRecencyGroup<T> {
  bucket: RecencyBucket;
  rows: T[];
  count: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// A session started today, in the last week, or before that. The week is the
// six days behind today so "this week" and "today" never overlap.
export const recencyBucket = (timestampMs: number, nowMs: number): RecencyBucket => {
  const startOfToday = new Date(nowMs).setHours(0, 0, 0, 0);

  if (timestampMs >= startOfToday) {
    return 'today';
  }

  return timestampMs >= startOfToday - 6 * DAY_MS ? 'week' : 'earlier';
};

// Buckets appear in the order the sort produces, so the grouping follows the
// sort rather than fighting it. Continuation rows inherit their head bucket.
export const groupSessionsByRecency = <T extends GroupableRow>(
  rows: readonly T[],
  nowMs: number,
): readonly RecencyGroup<T>[] => {
  const groups: MutableRecencyGroup<T>[] = [];

  for (const row of rows) {
    const previous = groups.at(-1);
    const bucket = row.continuation && previous != null
      ? previous.bucket
      : recencyBucket(row.session.lastTimestampMs, nowMs);
    const step = row.continuation ? 0 : 1;

    if (previous?.bucket !== bucket) {
      groups.push({
        bucket,
        rows: [row],
        count: step,
      });
    }
    else {
      previous.rows.push(row);
      previous.count += step;
    }
  }

  return groups;
};
