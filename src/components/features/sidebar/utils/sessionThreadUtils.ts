import type { SessionSummary } from '@services/history/historyService';

export interface SessionThread {
  readonly key: string;
  // Fullest first, because a shorter part is a prefix of a longer one.
  readonly parts: readonly SessionSummary[];
  readonly head: SessionSummary;
  readonly messageCount: number;
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
}

interface Run {
  head: SessionSummary;
  readonly parts: SessionSummary[];
}

export type SessionThreadOrder = 'newest' | 'oldest';

// One flattened row of a thread: its fullest transcript (continuation false)
// or a part revealed by expanding it (continuation true).
export interface SessionRow {
  readonly session: SessionSummary;
  readonly threadKey: string;
  readonly partCount: number;
  readonly messageCount: number;
  readonly continuation: boolean;
}

export interface ThreadRun {
  readonly head: SessionRow;
  readonly parts: readonly SessionRow[];
}

/**
 * Rewinding a session writes the messages up to that point into a fresh file,
 * so one conversation ends up as several transcripts that all begin with the
 * same first message. That shared root is the only recorded link between them:
 * no transcript on disk carries a parent pointer into another file, and the
 * `leafUuid` on a `last-prompt` record bookmarks a prompt rather than a file.
 *
 * A transcript that records no root stands alone. Grouping by a clock gap
 * instead fired on seven pairs in one project here and was wrong on every one
 * of them, so there is no fallback guess.
 */
const groupKey = (session: SessionSummary): string => {
  return session.rootUuid == null
    ? `file:${session.filePath}`
    : `${session.agent}:${session.rootUuid}`;
};

// Parts overlap, so the fullest part is the thread's message count, not their sum.
const threadFrom = (key: string, run: Run): SessionThread => {
  return {
    key,
    parts: [...run.parts].sort((left, right) => {
      return right.messageCount - left.messageCount;
    }),
    head: run.head,
    messageCount: run.head.messageCount,
    firstTimestampMs: Math.min(...run.parts.map((part) => {
      return part.firstTimestampMs;
    })),
    lastTimestampMs: Math.max(...run.parts.map((part) => {
      return part.lastTimestampMs;
    })),
  };
};

// Groups a project's sessions into the conversations they actually were, then
// orders the threads from the end of their history the reader asked for.
export const buildSessionThreads = (
  sessions: readonly SessionSummary[],
  order: SessionThreadOrder = 'newest',
): readonly SessionThread[] => {
  const runs = new Map<string, Run>();

  for (const session of sessions) {
    const key = groupKey(session);
    const run = runs.get(key);

    if (run == null) {
      runs.set(key, {
        head: session,
        parts: [session],
      });
      continue;
    }

    run.parts.push(session);

    if (session.messageCount > run.head.messageCount) {
      run.head = session;
    }
  }

  return [...runs].map(([key, run]) => {
    return threadFrom(key, run);
  }).sort((left, right) => {
    return order === 'newest'
      ? right.lastTimestampMs - left.lastTimestampMs
      : left.lastTimestampMs - right.lastTimestampMs;
  });
};

/**
 * The card an expanded thread's parts render inside: a head row and the
 * continuation rows immediately after it, together, so a part reads as
 * belonging to its thread instead of just sitting under it. A standalone
 * row, threaded or not yet expanded, is a run of its own with no parts.
 */
export const groupThreadRuns = (rows: readonly SessionRow[]): readonly ThreadRun[] => {
  const runs: { head: SessionRow;
    parts: SessionRow[]; }[] = [];

  for (const row of rows) {
    const current = row.continuation ? runs.at(-1) : undefined;

    if (current == null) {
      runs.push({
        head: row,
        parts: [],
      });
    }
    else {
      current.parts.push(row);
    }
  }

  return runs;
};
