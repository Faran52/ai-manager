import { pairToolOutcomes } from '@services/history/historyService';
import { uniqueKeys } from '@utils/reactKeyUtils';

import { entryIsVisible } from './messageFilterUtils';

import type { HistoryEntry, ToolOutcome } from '@services/history/historyService';
import type { MessageFilters } from './messageFilterUtils';

export interface TimelineEntryRow {
  readonly kind: 'entry';
  readonly entry: HistoryEntry;
  readonly key: string;
  readonly dimmed: boolean;
  // True when the row before it was the same speaker, so it needs no header of its own.
  readonly continues: boolean;
}

export interface TimelineDateRow {
  readonly kind: 'date';
  readonly key: string;
  readonly timestampMs: number;
}

export type TimelineRow = TimelineEntryRow | TimelineDateRow;

export interface TimelineModel {
  readonly rows: readonly TimelineRow[];
  readonly pairs: ReadonlyMap<string, ToolOutcome>;
  readonly orphans: ReadonlyMap<string, readonly ToolOutcome[]>;
}

interface EntryDay {
  readonly key: string;
  readonly timestampMs: number;
}

const entryIdentity = (entry: HistoryEntry): string => {
  return entry.kind === 'summary' ? `summary-${entry.text}` : `${entry.kind}-${entry.uuid}`;
};

// A summary carries no timestamp, so it inherits the day already being drawn.
const dayOf = (entry: HistoryEntry): EntryDay | undefined => {
  if (entry.kind === 'summary') {
    return undefined;
  }

  const timestampMs = Date.parse(entry.timestamp);

  return Number.isNaN(timestampMs)
    ? undefined
    : {
        key: new Date(timestampMs).toISOString().slice(0, 10),
        timestampMs,
      };
};

/**
 * A run of tool calls arrives as one assistant entry each, and repeating the
 * speaker, clock and model above every one of them buries the conversation.
 * Only the first of a run introduces itself.
 */
const speaksAgain = (previous: HistoryEntry | undefined, entry: HistoryEntry): boolean => {
  if (previous?.kind !== entry.kind) {
    return false;
  }

  if (entry.kind === 'assistant' && previous.kind === 'assistant') {
    return previous.model === entry.model && previous.sidechain === entry.sidechain;
  }

  return entry.kind === 'user' && previous.kind === 'user' && previous.sidechain === entry.sidechain;
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
 * Flattens a feed into exactly the rows the timeline will draw, day separators
 * included.
 *
 * Filtered entries are dropped here rather than returning null mid-render, and
 * separators are rows rather than decoration, because a virtualized list
 * indexes by position: anything the model does not count is a gap the
 * virtualizer reserves no space for.
 */
export const buildTimelineModel = (
  entries: readonly HistoryEntry[],
  filters: MessageFilters,
): TimelineModel => {
  const pairs = pairToolOutcomes(entries);
  const keys = uniqueKeys(entries, entryIdentity);
  const rows: TimelineRow[] = [];

  let drawnDay = '';
  let previous: HistoryEntry | undefined;

  for (const [index, entry] of entries.entries()) {
    if (!entryIsVisible(entry, filters, pairs)) {
      continue;
    }

    const day = dayOf(entry);
    const openedDay = day != null && day.key !== drawnDay;

    if (openedDay) {
      drawnDay = day.key;
      rows.push({
        kind: 'date',
        key: `date-${day.key}`,
        timestampMs: day.timestampMs,
      });
    }

    rows.push({
      kind: 'entry',
      entry,
      /* v8 ignore next -- keys is built from the same array, so the index always hits */
      key: keys[index] ?? entryIdentity(entry),
      dimmed: entry.kind !== 'summary' && entry.sidechain,
      continues: !openedDay && speaksAgain(previous, entry),
    });
    previous = entry;
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
    return row.kind === 'entry' && row.entry.kind !== 'summary' && row.entry.timestamp === timestamp;
  });
};

// The floating date follows whatever row the viewport starts on, and a
// separator names its own day while an entry has to be asked for one.
export const dayAtRow = (rows: readonly TimelineRow[], index: number): number => {
  for (let cursor = Math.min(index, rows.length - 1); cursor >= 0; cursor -= 1) {
    const row = rows[cursor];

    if (row?.kind === 'date') {
      return row.timestampMs;
    }
  }

  return 0;
};
