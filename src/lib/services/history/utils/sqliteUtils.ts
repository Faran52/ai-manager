import { stat } from 'node:fs/promises';
import {
  basename,
  dirname,
  extname,
} from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { zstdDecompressSync } from 'node:zlib';

import { appConfig } from '@config/appConfig';

import {
  isJsonArray,
  isJsonObject,
  objectAt,
  parseJsonContainer,
} from '@utils/jsonUtils';
import { containedIn } from '@utils/pathUtils';
import { humanPreview } from '@utils/titleUtils';

import { cursorSessions } from './cursorUtils';
import { conversationMessageCount, firstUserMessageText } from './outcomeUtils';
import { projectsFromSessions } from './projectSummaryUtils';
import {
  jsonString,
  sqliteText,
  tableNames,
  tableSet,
  timestampRange,
} from './sqliteSharedUtils';
import { parseStructuredHistory } from './structuredUtils';
import { listTree } from './treeUtils';

import type { AgentId } from '@config/agents';
import type {
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
} from '@services/history/types';
import type { JsonObject, JsonValue } from '@utils/jsonUtils';
import type { SQLOutputValue } from 'node:sqlite';
import type { DecodedSqliteSession, SqliteEntry } from './sqliteSharedUtils';

interface SqliteReference {
  readonly databasePath: string;
  readonly decoder?: SqliteDecoder | undefined;
  readonly sessionId?: string | undefined;
  readonly table: string;
}

type SqliteDecoder = 'crush' | 'cursor' | 'goose' | 'llm' | 'table' | 'zed';

interface SqliteSession {
  readonly summary: SessionSummary;
  readonly entries: readonly HistoryEntry[];
}

type SqliteDeletion = (database: DatabaseSync, sessionId: string) => void;

const databaseExtensions = new Set(['.db', '.sqlite', '.sqlite3', '.vscdb']);
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
    && typeof value.table === 'string'
    && (!('decoder' in value) || value.decoder === 'crush' || value.decoder === 'cursor'
      || value.decoder === 'goose' || value.decoder === 'llm' || value.decoder === 'table'
      || value.decoder === 'zed')
    && (!('sessionId' in value) || typeof value.sessionId === 'string');
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
  return (await listTree(root, depth)).filter((filePath) => {
    return databaseExtensions.has(extname(filePath).toLowerCase());
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

const gooseEntries = (
  database: DatabaseSync,
  sessionId: string,
  fallbackMs: number,
): readonly SqliteEntry[] => {
  const rows = database.prepare(
    'SELECT id, role, content_json, created_timestamp FROM messages WHERE session_id = ? ORDER BY id ASC',
  ).all(sessionId);

  return rows.flatMap((row) => {
    const role = sqliteText(row.role);
    const content = parseJsonContainer(sqliteText(row.content_json));
    const timestamp = typeof row.created_timestamp === 'number' ? row.created_timestamp : fallbackMs;

    return parseStructuredHistory(JSON.stringify({
      id: String(row.id),
      role,
      content,
      timestamp,
    }), '.json', fallbackMs);
  });
};

const gooseSessions = (
  database: DatabaseSync,
  fallbackMs: number,
): readonly DecodedSqliteSession[] => {
  const tables = tableSet(database);

  if (!tables.has('sessions') || !tables.has('messages')) {
    return [];
  }

  const sessionRows = database.prepare(
    'SELECT id, name, working_dir, created_at, updated_at FROM sessions ORDER BY updated_at DESC',
  ).all();

  return sessionRows.flatMap((row) => {
    const sessionId = sqliteText(row.id);
    const entries = gooseEntries(database, sessionId, fallbackMs);

    if (sessionId.length === 0 || entries.length === 0) {
      return [];
    }

    const range = timestampRange(entries);

    return [{
      actualSessionId: sessionId,
      cwd: sqliteText(row.working_dir) || 'unknown',
      entries,
      firstTimestampMs: range.firstTimestampMs,
      lastTimestampMs: range.lastTimestampMs,
      title: sqliteText(row.name) || undefined,
    }];
  });
};

/*
 * llm logs one row per exchange with no role column (verified against
 * llm/migrations.py). The reply is timestamped after its duration, so prompt sorts first.
 */
const llmEntries = (
  database: DatabaseSync,
  conversationId: string,
  fallbackMs: number,
): readonly SqliteEntry[] => {
  const rows = database.prepare(
    `SELECT id, model, resolved_model, prompt, system, response, duration_ms, datetime_utc
     FROM responses WHERE conversation_id = ? ORDER BY id ASC`,
  ).all(conversationId);
  const records: JsonObject[] = [];
  let sawSystem = false;

  for (const row of rows) {
    const parsedMs = Date.parse(sqliteText(row.datetime_utc));
    const startMs = Number.isFinite(parsedMs) ? parsedMs : fallbackMs;
    const durationMs = typeof row.duration_ms === 'number' ? row.duration_ms : 0;
    const system = sqliteText(row.system);

    if (!sawSystem && system.length > 0) {
      records.push({
        id: `${String(row.id)}-system`,
        role: 'system',
        content: system,
        timestamp: startMs,
      });
      sawSystem = true;
    }

    records.push({
      id: `${String(row.id)}-prompt`,
      role: 'user',
      content: sqliteText(row.prompt),
      timestamp: startMs,
    });
    records.push({
      id: `${String(row.id)}-response`,
      role: 'assistant',
      content: sqliteText(row.response),
      model: sqliteText(row.resolved_model) || sqliteText(row.model),
      timestamp: startMs + durationMs,
    });
  }

  return parseStructuredHistory(JSON.stringify(records), '.json', fallbackMs);
};

/*
 * Crush messages.parts is a discriminated union, not the flat text shape the generic
 * reader checks. Only text parts: the others' field shapes are unverified.
 */
const crushText = (parts: JsonValue): string => {
  if (!isJsonArray(parts)) {
    return '';
  }

  return parts.flatMap((part) => {
    if (!isJsonObject(part) || part.type !== 'text') {
      return [];
    }

    const text = jsonString(objectAt(part, 'data')?.text);

    return text == null ? [] : [text];
  }).join('\n');
};

const crushEntries = (
  database: DatabaseSync,
  sessionId: string,
  fallbackMs: number,
): readonly SqliteEntry[] => {
  const rows = database.prepare(
    'SELECT id, role, parts, model, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC, id ASC',
  ).all(sessionId);
  const records = rows.map((row) => {
    return {
      id: sqliteText(row.id),
      role: sqliteText(row.role),
      content: crushText(parseJsonContainer(sqliteText(row.parts))),
      model: sqliteText(row.model) || undefined,
      created_at: typeof row.created_at === 'number' ? row.created_at : fallbackMs,
    };
  });

  return parseStructuredHistory(JSON.stringify(records), '.json', fallbackMs);
};

const crushSessions = (
  database: DatabaseSync,
  fallbackMs: number,
): readonly DecodedSqliteSession[] => {
  const tables = tableSet(database);

  if (!tables.has('sessions') || !tables.has('messages')) {
    return [];
  }

  const sessionRows = database
    .prepare('SELECT id, title FROM sessions ORDER BY updated_at DESC')
    .all();

  return sessionRows.flatMap((row) => {
    const sessionId = sqliteText(row.id);
    const entries = crushEntries(database, sessionId, fallbackMs);

    if (sessionId.length === 0 || entries.length === 0) {
      return [];
    }

    return [{
      actualSessionId: sessionId,
      cwd: 'unknown',
      entries,
      ...timestampRange(entries),
      title: sqliteText(row.title) || undefined,
    }];
  });
};

const llmSessions = (
  database: DatabaseSync,
  fallbackMs: number,
): readonly DecodedSqliteSession[] => {
  const tables = tableSet(database);

  if (!tables.has('conversations') || !tables.has('responses')) {
    return [];
  }

  const conversationRows = database.prepare('SELECT id, name FROM conversations').all();

  return conversationRows.flatMap((row) => {
    const conversationId = sqliteText(row.id);
    const entries = llmEntries(database, conversationId, fallbackMs);

    if (conversationId.length === 0 || entries.length === 0) {
      return [];
    }

    return [{
      actualSessionId: conversationId,
      cwd: 'unknown',
      entries,
      ...timestampRange(entries),
      title: sqliteText(row.name) || undefined,
    }];
  });
};

const zedData = (dataType: string, value: SQLOutputValue | undefined): string => {
  if (!(value instanceof Uint8Array)) {
    return sqliteText(value);
  }

  return dataType.toLowerCase() === 'zstd'
    ? zstdDecompressSync(value).toString()
    : Buffer.from(value).toString();
};

const zedSessions = (
  database: DatabaseSync,
  databasePath: string,
  fallbackMs: number,
): readonly DecodedSqliteSession[] => {
  if (!tableSet(database).has('threads')) {
    return [];
  }

  const threadRows = database.prepare(
    'SELECT id, summary, updated_at, data_type, data FROM threads ORDER BY updated_at DESC',
  ).all();

  return threadRows.flatMap((row) => {
    try {
      const sessionId = sqliteText(row.id);
      const content = zedData(sqliteText(row.data_type), row.data);
      const entries = parseStructuredHistory(content, '.json', fallbackMs);

      if (sessionId.length === 0 || entries.length === 0) {
        return [];
      }

      return [{
        actualSessionId: sessionId,
        cwd: dirname(databasePath),
        entries,
        ...timestampRange(entries),
        title: sqliteText(row.summary) || undefined,
      }];
    }
    catch {
      return [];
    }
  });
};

const decodedSessions = (
  agent: AgentId,
  database: DatabaseSync,
  databasePath: string,
  fallbackMs: number,
): readonly DecodedSqliteSession[] => {
  if (agent === 'cursor') {
    return cursorSessions(database, databasePath, fallbackMs);
  }

  if (agent === 'crush') {
    return crushSessions(database, fallbackMs);
  }

  if (agent === 'goose') {
    return gooseSessions(database, fallbackMs);
  }

  if (agent === 'llm') {
    return llmSessions(database, fallbackMs);
  }

  return zedSessions(database, databasePath, fallbackMs);
};

const decoderFor = (agent: AgentId, tables: ReadonlySet<string>): SqliteDecoder | undefined => {
  if (agent === 'cursor' && tables.has('cursorDiskKV')) {
    return 'cursor';
  }

  if (agent === 'crush' && tables.has('sessions') && tables.has('messages')) {
    return 'crush';
  }

  if (agent === 'goose' && tables.has('sessions') && tables.has('messages')) {
    return 'goose';
  }

  if (agent === 'llm' && tables.has('conversations') && tables.has('responses')) {
    return 'llm';
  }

  return agent === 'zed' && tables.has('threads') ? 'zed' : undefined;
};

const tableForDecoder = (decoder: SqliteDecoder): string => {
  if (decoder === 'zed') {
    return 'threads';
  }

  if (decoder === 'llm') {
    return 'responses';
  }

  return decoder === 'goose' || decoder === 'crush' ? 'messages' : 'cursorDiskKV';
};

const sessionsForReference = (
  database: DatabaseSync,
  reference: SqliteReference,
  fallbackMs: number,
): readonly DecodedSqliteSession[] => {
  if (reference.decoder === 'cursor') {
    return cursorSessions(database, reference.databasePath, fallbackMs);
  }

  if (reference.decoder === 'crush') {
    return crushSessions(database, fallbackMs);
  }

  if (reference.decoder === 'goose') {
    return gooseSessions(database, fallbackMs);
  }

  if (reference.decoder === 'llm') {
    return llmSessions(database, fallbackMs);
  }

  return zedSessions(database, reference.databasePath, fallbackMs);
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

    const decoder = decoderFor(agent, tableSet(openedDatabase));

    if (decoder != null) {
      return decodedSessions(agent, openedDatabase, databasePath, info.mtimeMs).map((session) => {
        const preview = firstUserMessageText(session.entries);

        return {
          entries: session.entries,
          summary: {
            agent,
            actualSessionId: session.actualSessionId,
            id: `${basename(databasePath)}:${session.actualSessionId}`,
            filePath: encodeReference({
              databasePath,
              decoder,
              sessionId: session.actualSessionId,
              table: tableForDecoder(decoder),
            }),
            projectId: session.cwd,
            title: session.title,
            preview: preview == null ? undefined : humanPreview(preview, appConfig.previewLength),
            messageCount: conversationMessageCount(session.entries),
            firstTimestampMs: session.firstTimestampMs,
            lastTimestampMs: session.lastTimestampMs,
            modifiedMs: info.mtimeMs,
            sizeBytes: info.size,
            cwd: session.cwd,
          },
        };
      });
    }

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
      const preview = firstUserMessageText(entries);

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
          preview: preview == null ? undefined : humanPreview(preview, appConfig.previewLength),
          messageCount: conversationMessageCount(entries),
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
  const summaries = sessions.map((session) => {
    return session.summary;
  });

  return projectsFromSessions(agent, summaries, (id) => {
    return {
      name: basename(id),
      actualPath: id,
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

const childThenParent = (child: string, key: string, parent: string): SqliteDeletion => {
  return (database, sessionId) => {
    database.prepare(`DELETE FROM ${quoteIdentifier(child)} WHERE ${quoteIdentifier(key)} = ?`).run(sessionId);
    database.prepare(`DELETE FROM ${quoteIdentifier(parent)} WHERE id = ?`).run(sessionId);
  };
};

// Undefined where a "session" is a whole undecoded table, not a conversation.
const DELETIONS: Readonly<Record<SqliteDecoder, SqliteDeletion | undefined>> = {
  crush: childThenParent('messages', 'session_id', 'sessions'),
  cursor: (database, sessionId) => {
    database.prepare('DELETE FROM cursorDiskKV WHERE key = ?').run(`composerData:${sessionId}`);
    database.prepare('DELETE FROM cursorDiskKV WHERE key LIKE ?').run(`bubbleId:${sessionId}:%`);
  },
  goose: childThenParent('messages', 'session_id', 'sessions'),
  llm: childThenParent('responses', 'conversation_id', 'conversations'),
  table: undefined,
  zed: (database, sessionId) => {
    database.prepare('DELETE FROM threads WHERE id = ?').run(sessionId);
  },
};

export const deleteSqliteSession = async (
  filePath: string,
  allowedRoots: readonly string[],
): Promise<void> => {
  const reference = decodeReference(filePath);

  if (reference?.decoder == null || reference.sessionId == null) {
    throw new Error('This is not a usable session reference.');
  }

  const remove = DELETIONS[reference.decoder];

  if (remove == null) {
    throw new Error('This agent keeps its sessions inside a shared database, so they stay read-only.');
  }

  if (!await containedIn(allowedRoots, reference.databasePath)) {
    throw new Error('The session database is outside its agent history directory.');
  }

  await stat(reference.databasePath);

  const database = new DatabaseSync(reference.databasePath);

  try {
    database.exec('BEGIN');
    remove(database, reference.sessionId);
    database.exec('COMMIT');
  }
  catch (error) {
    database.exec('ROLLBACK');

    throw error;
  }
  finally {
    database.close();
  }
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

    if (reference.decoder != null && reference.decoder !== 'table' && reference.sessionId != null) {
      const sessions = sessionsForReference(database, reference, Date.now());

      return sessions.find((session) => {
        return session.actualSessionId === reference.sessionId;
      })?.entries;
    }

    return entriesFromTable(database, reference.table, Date.now());
  }
  catch {
    return undefined;
  }
  finally {
    database?.close();
  }
};
