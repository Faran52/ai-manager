import { readdir, stat } from 'node:fs/promises';
import {
  basename,
  dirname,
  extname,
} from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { appConfig } from '@config/appConfig';

import { containedIn } from '@utils/pathUtils';
import { humanPreview } from '@utils/titleUtils';

import { parseStructuredHistory } from './structuredUtils';

import type { AgentId } from '@config/agents';
import type {
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
} from '../types';

interface SqliteReference {
  readonly databasePath: string;
  readonly table: string;
}

interface SqliteSession {
  readonly summary: SessionSummary;
  readonly entries: readonly HistoryEntry[];
}

export const databaseExtensions = new Set(['.db', '.sqlite', '.sqlite3', '.vscdb']);
const SQLITE_PREFIX = 'sqlite:';
const ROW_LIMIT = 10_000;

const quoteIdentifier = (value: string): string => {
  return `"${value.replaceAll('"', '""')}"`;
};

const isSqliteReference = (value: unknown): value is SqliteReference => {
  return typeof value === 'object'
    && value !== null
    && 'databasePath' in value
    && typeof value.databasePath === 'string'
    && 'table' in value
    && typeof value.table === 'string';
};

export const encodeReference = (reference: SqliteReference): string => {
  return `${SQLITE_PREFIX}${Buffer.from(JSON.stringify(reference)).toString('base64url')}`;
};

export const decodeReference = (filePath: string): SqliteReference | undefined => {
  if (!filePath.startsWith(SQLITE_PREFIX)) {
    return undefined;
  }

  try {
    const value: unknown = JSON.parse(Buffer.from(filePath.slice(SQLITE_PREFIX.length), 'base64url').toString());

    return isSqliteReference(value) ? value : undefined;
  }
  catch {
    return undefined;
  }
};

export const databaseFiles = async (root: string, depth: number): Promise<readonly string[]> => {
  try {
    const info = await stat(root);

    if (info.isFile()) {
      return databaseExtensions.has(extname(root).toLowerCase()) ? [root] : [];
    }

    if (!info.isDirectory() || depth < 1) {
      return [];
    }

    const files: string[] = [];

    for (const dirent of await readdir(root, { withFileTypes: true })) {
      if (dirent.name === 'node_modules' || dirent.name === '.git') {
        continue;
      }

      files.push(...await databaseFiles(`${root}/${dirent.name}`, depth - 1));
    }

    return files;
  }
  catch {
    return [];
  }
};

const tableNames = (database: DatabaseSync): readonly string[] => {
  const statement = "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'";
  const rows = database.prepare(statement).all();

  return rows.map((row) => {
    return String(row.name);
  });
};

const entriesFromTable = (database: DatabaseSync, table: string, fallbackMs: number) => {
  try {
    const rows = database.prepare(`SELECT * FROM ${quoteIdentifier(table)} LIMIT ${String(ROW_LIMIT)}`).all();
    const content = JSON.stringify(rows);

    return parseStructuredHistory(content, '.json', fallbackMs);
  }
  catch {
    return [];
  }
};

const sessionsFromDatabase = async (
  agent: AgentId,
  databasePath: string,
): Promise<readonly SqliteSession[]> => {
  let database: DatabaseSync | undefined;

  try {
    const info = await stat(databasePath);

    const openedDatabase = new DatabaseSync(databasePath, { readOnly: true });

    database = openedDatabase;

    return tableNames(openedDatabase).flatMap((table) => {
      const entries = entriesFromTable(openedDatabase, table, info.mtimeMs);

      if (entries.length === 0) {
        return [];
      }

      const id = `${basename(databasePath)}:${table}`;
      const projectId = dirname(databasePath);
      const stamps = entries.map((entry) => {
        return Date.parse(entry.timestamp);
      }).filter(Number.isFinite);
      const preview = entries.find((entry) => {
        return entry.kind === 'user';
      });

      return [{
        entries,
        summary: {
          agent,
          actualSessionId: id,
          id,
          filePath: encodeReference({
            databasePath,
            table,
          }),
          projectId,
          preview: preview?.kind === 'user'
            ? humanPreview(preview.text, appConfig.previewLength)
            : undefined,
          messageCount: entries.length,
          firstTimestampMs: Math.min(...stamps),
          lastTimestampMs: Math.max(...stamps),
          modifiedMs: info.mtimeMs,
          sizeBytes: info.size,
          cwd: dirname(databasePath),
        },
      }];
    });
  }
  catch {
    return [];
  }
  finally {
    database?.close();
  }
};

const scanSqliteSessions = async (
  agent: AgentId,
  roots: readonly string[],
): Promise<readonly SqliteSession[]> => {
  const sessions: SqliteSession[] = [];

  for (const root of roots) {
    for (const databasePath of await databaseFiles(root, 6)) {
      sessions.push(...await sessionsFromDatabase(agent, databasePath));
    }
  }

  return sessions;
};

export const listSqliteProjects = async (
  agent: AgentId,
  roots: readonly string[],
): Promise<readonly ProjectSummary[]> => {
  const sessions = await scanSqliteSessions(agent, roots);
  const grouped = new Map<string, SqliteSession[]>();

  for (const session of sessions) {
    const values = grouped.get(session.summary.projectId) ?? [];

    values.push(session);
    grouped.set(session.summary.projectId, values);
  }

  return [...grouped.entries()].map(([id, values]) => {
    return {
      agent,
      id,
      name: basename(id),
      actualPath: id,
      sessionCount: values.length,
      messageCount: values.reduce((total, value) => {
        return total + value.summary.messageCount;
      }, 0),
      lastActivityMs: values.reduce((latest, value) => {
        return Math.max(latest, value.summary.lastTimestampMs);
      }, 0),
    };
  });
};

export const listSqliteSessions = async (
  agent: AgentId,
  roots: readonly string[],
  projectId?: string,
): Promise<readonly SessionSummary[]> => {
  const sessions = await scanSqliteSessions(agent, roots);

  return sessions.filter((session) => {
    return projectId == null || session.summary.projectId === projectId;
  }).map((session) => {
    return session.summary;
  });
};

export const loadSqliteEntries = async (
  filePath: string,
  allowedRoots?: readonly string[],
): Promise<readonly HistoryEntry[] | undefined> => {
  const reference = decodeReference(filePath);

  if (reference == null || (allowedRoots != null && !await containedIn(allowedRoots, reference.databasePath))) {
    return undefined;
  }

  let database: DatabaseSync | undefined;

  try {
    database = new DatabaseSync(reference.databasePath, { readOnly: true });

    return entriesFromTable(database, reference.table, Date.now());
  }
  catch {
    return undefined;
  }
  finally {
    database?.close();
  }
};
