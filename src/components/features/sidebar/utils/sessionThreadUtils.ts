import type { SessionSummary } from '@services/history/historyService';

export interface SessionThread {
  readonly key: string;
  // Oldest first, so the parts read in the order they were written.
  readonly parts: readonly SessionSummary[];
  readonly head: SessionSummary;
  readonly messageCount: number;
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
}

interface Run {
  readonly head: SessionSummary;
  readonly parts: SessionSummary[];
}

/**
 * Resuming a session, and compacting one, both start a fresh transcript that
 * carries on where the last stopped. The tell is the seam: the next file begins
 * within a couple of minutes of the previous one ending, in the same working
 * directory. A wider window would start roping in genuinely separate work that
 * happened to follow, which reads worse than leaving the parts apart.
 */
const CONTINUATION_GAP_MS = 2 * 60 * 1000;

const continues = (previous: SessionSummary, next: SessionSummary): boolean => {
  if (previous.agent !== next.agent || previous.projectId !== next.projectId) {
    return false;
  }

  // A missing cwd on either side is no evidence, so it cannot be used as agreement.
  if (previous.cwd == null || next.cwd == null || previous.cwd !== next.cwd) {
    return false;
  }

  const gap = next.firstTimestampMs - previous.lastTimestampMs;

  return gap >= 0 && gap <= CONTINUATION_GAP_MS;
};

const threadFrom = ({ head, parts }: Run): SessionThread => {
  return {
    key: head.filePath,
    parts,
    head,
    messageCount: parts.reduce((total, part) => {
      return total + part.messageCount;
    }, 0),
    firstTimestampMs: head.firstTimestampMs,
    lastTimestampMs: parts.reduce((latest, part) => {
      return Math.max(latest, part.lastTimestampMs);
    }, 0),
  };
};

// Groups a project's sessions into the conversations they actually were, then
// orders the threads the way the flat list was ordered: most recent first.
export const buildSessionThreads = (sessions: readonly SessionSummary[]): readonly SessionThread[] => {
  const chronological = [...sessions].sort((left, right) => {
    return left.firstTimestampMs - right.firstTimestampMs;
  });
  const runs: Run[] = [];

  for (const session of chronological) {
    const previous = runs.at(-1)?.parts.at(-1);

    if (previous == null || !continues(previous, session)) {
      runs.push({
        head: session,
        parts: [session],
      });
      continue;
    }

    runs.at(-1)?.parts.push(session);
  }

  return runs.map(threadFrom).sort((left, right) => {
    return right.lastTimestampMs - left.lastTimestampMs;
  });
};
