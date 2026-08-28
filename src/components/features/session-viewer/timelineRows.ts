import { pairToolOutcomes } from '@services/history/historyService';
import { uniqueKeys } from '@utils/reactKeyUtils';

import { entryIsVisible } from './messageFilters';

import type { HistoryEntry, ToolOutcome } from '@services/history/historyService';
import type { MessageFilters } from './messageFilters';

export interface TimelineRow {
  readonly entry: HistoryEntry;
  readonly key: string;
  readonly dimmed: boolean;
}

export interface TimelineModel {
  readonly rows: readonly TimelineRow[];
  readonly pairs: ReadonlyMap<string, ToolOutcome>;
  readonly orphans: ReadonlyMap<string, readonly ToolOutcome[]>;
}

const entryIdentity = (entry: HistoryEntry): string => {
  return entry.kind === 'summary' ? `summary-${entry.text}` : `${entry.kind}-${entry.uuid}`;
};

const orphansOf = (
  entries: readonly HistoryEntry[],
  pairs: ReadonlyMap<string, ToolOutcome>,
): ReadonlyMap<string, readonly ToolOutcome[]> => {
  const map = new Map<string, readonly ToolOutcome[]>();

  for (const entry of entries) {
    if (entry.kind !== 'user' || entry.outcomes.length === 0) {
      continue;
    }

    map.set(entry.uuid, entry.outcomes.filter((outcome) => {
      return !pairs.has(outcome.toolUseId);
    }));
  }

  return map;
};

/**
 * Flattens a feed into exactly the rows the timeline will draw.
 *
 * Filtered entries are dropped here rather than returning null mid-render,
 * because a virtualized list indexes by position: a hole in the middle would
 * make the virtualizer reserve space for a row nobody can see.
 */
export const buildTimelineModel = (
  entries: readonly HistoryEntry[],
  filters: MessageFilters,
): TimelineModel => {
  const pairs = pairToolOutcomes(entries);
  const keys = uniqueKeys(entries, entryIdentity);
  const rows: TimelineRow[] = [];

  for (const [index, entry] of entries.entries()) {
    if (!entryIsVisible(entry, filters, pairs)) {
      continue;
    }

    rows.push({
      entry,
      /* v8 ignore next -- keys is built from the same array, so the index always hits */
      key: keys[index] ?? entryIdentity(entry),
      dimmed: entry.kind !== 'summary' && entry.sidechain,
    });
  }

  return {
    rows,
    pairs,
    orphans: orphansOf(entries, pairs),
  };
};

// The search jump lands on a timestamp, but a virtualizer scrolls to an index,
// so the lookup has to happen against the rows actually being drawn.
export const rowIndexForTimestamp = (
  rows: readonly TimelineRow[],
  timestamp: string | undefined,
): number => {
  if (timestamp == null) {
    return -1;
  }

  return rows.findIndex((row) => {
    return row.entry.kind !== 'summary' && row.entry.timestamp === timestamp;
  });
};
