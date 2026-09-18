import { maxOf, minOf } from '@utils/arrayUtils';

import type { HistoryEntry, SummaryTurnEntry } from '@services/history/types';
import type { JsonValue } from '@utils/jsonUtils';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';

/*
 * What every SQLite-backed decoder needs and none of them owns. It sits apart
 * from `sqliteUtils` so a decoder in its own file can reach it without importing
 * the dispatcher that imports the decoder back.
 */
export type SqliteEntry = Exclude<HistoryEntry, SummaryTurnEntry>;

export interface TimestampRange {
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
}

export interface DecodedSqliteSession {
  readonly actualSessionId: string;
  readonly cwd: string;
  readonly entries: readonly SqliteEntry[];
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
  readonly title?: string | undefined;
}

export const jsonNumber = (value: JsonValue | undefined): number | undefined => {
  return typeof value === 'number' ? value : undefined;
};

export const jsonString = (value: JsonValue | undefined): string | undefined => {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

export const sqliteText = (value: SQLOutputValue | undefined): string => {
  if (typeof value === 'string') {
    return value;
  }

  return value instanceof Uint8Array ? Buffer.from(value).toString() : '';
};

export const tableNames = (database: DatabaseSync): readonly string[] => {
  const statement = "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'";
  const rows = database.prepare(statement).all();

  return rows.map((row) => {
    return String(row.name);
  });
};

export const tableSet = (database: DatabaseSync): ReadonlySet<string> => {
  return new Set(tableNames(database));
};

// A Cursor composer runs to thousands of bubbles, which is more than a spread
// into Math.min takes.
export const timestampRange = (entries: readonly SqliteEntry[]): TimestampRange => {
  const stamps = entries.map((entry) => {
    return Date.parse(entry.timestamp);
  });

  return {
    firstTimestampMs: minOf(stamps, (stamp) => {
      return stamp;
    }),
    lastTimestampMs: maxOf(stamps, (stamp) => {
      return stamp;
    }),
  };
};
