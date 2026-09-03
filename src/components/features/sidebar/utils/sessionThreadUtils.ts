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
// orders the threads the way the flat list was ordered: most recent first.
export const buildSessionThreads = (sessions: readonly SessionSummary[]): readonly SessionThread[] => {
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
    return right.lastTimestampMs - left.lastTimestampMs;
  });
};
