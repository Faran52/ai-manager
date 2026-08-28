import type { SessionSummary } from '@services/history/historyService';

export type BoardAttribute = 'messages' | 'size' | 'duration' | 'recency';

export interface BoardCell {
  readonly session: SessionSummary;
  readonly value: number;
  // 0 to 1, the session's share of the busiest one on the chosen attribute.
  readonly intensity: number;
}

export interface BoardDay {
  readonly date: string;
  readonly sessions: number;
  readonly intensity: number;
}

export interface BoardModel {
  readonly cells: readonly BoardCell[];
  readonly days: readonly BoardDay[];
  readonly max: number;
}

export const boardAttributes: readonly BoardAttribute[] = ['messages', 'size', 'duration', 'recency'];

const durationOf = (session: SessionSummary): number => {
  return Math.max(0, session.lastTimestampMs - session.firstTimestampMs);
};

export const attributeValue = (
  session: SessionSummary,
  attribute: BoardAttribute,
  nowMs: number,
): number => {
  switch (attribute) {
    case 'messages':
      return session.messageCount;
    case 'size':
      return session.sizeBytes;
    case 'duration':
      return durationOf(session);
    case 'recency':
      // Inverted so the freshest session is the brightest, like every other attribute.
      return Math.max(0, nowMs - session.lastTimestampMs);
  }
};

const dayKey = (timestampMs: number): string => {
  return new Date(timestampMs).toISOString().slice(0, 10);
};

const daysFrom = (sessions: readonly SessionSummary[]): readonly BoardDay[] => {
  const counts = new Map<string, number>();

  for (const session of sessions) {
    if (session.lastTimestampMs > 0) {
      const key = dayKey(session.lastTimestampMs);

      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const busiest = Math.max(1, ...counts.values());

  return [...counts.entries()]
    .map(([date, sessions_]) => {
      return {
        date,
        sessions: sessions_,
        intensity: sessions_ / busiest,
      };
    })
    .sort((left, right) => {
      return left.date.localeCompare(right.date);
    });
};

// Every cell is scaled against the busiest session rather than against a fixed
// ceiling, so a quiet project still reads as a spread instead of a flat grid.
export const buildBoardModel = (
  sessions: readonly SessionSummary[],
  attribute: BoardAttribute,
  nowMs: number,
): BoardModel => {
  const scored = sessions.map((session) => {
    return {
      session,
      value: attributeValue(session, attribute, nowMs),
    };
  });
  const max = Math.max(0, ...scored.map((entry) => {
    return entry.value;
  }));
  const cells = scored.map((entry) => {
    const share = max === 0 ? 0 : entry.value / max;

    return {
      session: entry.session,
      value: entry.value,
      intensity: attribute === 'recency' ? 1 - share : share,
    };
  }).sort((left, right) => {
    return right.session.lastTimestampMs - left.session.lastTimestampMs;
  });

  return {
    cells,
    days: daysFrom(sessions),
    max,
  };
};
