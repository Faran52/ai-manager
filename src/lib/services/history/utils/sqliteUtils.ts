import { stat } from 'node:fs/promises';
import {
  basename,
  dirname,
  extname,
} from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { zstdDecompressSync } from 'node:zlib';

import { sumBy } from 'es-toolkit';

import { appConfig } from '@config/appConfig';

import { maxOf } from '@utils/arrayUtils';
import {
  isJsonArray,
  isJsonObject,
  parseJsonContainer,
} from '@utils/jsonUtils';
import { containedIn } from '@utils/pathUtils';
import { humanPreview } from '@utils/titleUtils';

import { parseToolInput, splitUserText } from '../../session/utils/parserUtils';

import { conversationMessageCount, firstUserMessageText } from './outcomeUtils';
import { parseStructuredHistory } from './structuredUtils';
import { listTree } from './treeUtils';

import type { AgentId } from '@config/agents';
import type { JsonObject, JsonValue } from '@utils/jsonUtils';
import type { SQLOutputValue } from 'node:sqlite';
import type {
  AssistantBlock,
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
  ToolOutcome,
  ToolStatus,
} from '../types';
import type { RawToolInput } from './claudeRawUtils';

interface SqliteReference {
  readonly databasePath: string;
  readonly decoder?: SqliteDecoder | undefined;
  readonly sessionId?: string | undefined;
  readonly table: string;
}

type SqliteDecoder = 'crush' | 'cursor' | 'goose' | 'llm' | 'table' | 'zed';
type SqliteEntry = Exclude<HistoryEntry, { kind: 'summary' }>;

interface DecodedSqliteSession {
  readonly actualSessionId: string;
  readonly cwd: string;
  readonly entries: readonly SqliteEntry[];
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
  readonly title?: string | undefined;
}

interface CursorBubbleHeader {
  readonly bubbleId: string;
  readonly type: number;
}

interface TimestampRange {
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
}

interface SqliteSession {
  readonly summary: SessionSummary;
  readonly entries: readonly HistoryEntry[];
}

interface CursorToolParts {
  readonly block: AssistantBlock;
  readonly outcome: ToolOutcome;
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

const sqliteText = (value: SQLOutputValue | undefined): string => {
  if (typeof value === 'string') {
    return value;
  }

  return value instanceof Uint8Array ? Buffer.from(value).toString() : '';
};

const jsonString = (value: JsonValue | undefined): string | undefined => {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const jsonNumber = (value: JsonValue | undefined): number | undefined => {
  return typeof value === 'number' ? value : undefined;
};

const objectAt = (record: JsonObject, key: string): JsonObject | undefined => {
  const value = record[key];

  return isJsonObject(value) ? value : undefined;
};

const timestampRange = (entries: readonly SqliteEntry[]): TimestampRange => {
  const stamps = entries.map((entry) => {
    return Date.parse(entry.timestamp);
  });

  return {
    firstTimestampMs: Math.min(...stamps),
    lastTimestampMs: Math.max(...stamps),
  };
};

const tableSet = (database: DatabaseSync): ReadonlySet<string> => {
  return new Set(tableNames(database));
};

const cursorBubbleHeaders = (metadata: JsonObject): readonly CursorBubbleHeader[] => {
  const headers = metadata.fullConversationHeadersOnly;

  if (!isJsonArray(headers)) {
    return [];
  }

  return headers.flatMap((header) => {
    if (!isJsonObject(header)) {
      return [];
    }

    const bubbleId = jsonString(header.bubbleId);
    const type = jsonNumber(header.type);

    return bubbleId == null || type == null
      ? []
      : [{
          bubbleId,
          type,
        }];
  });
};

const cursorThinkingBlocks = (bubble: JsonObject): readonly AssistantBlock[] => {
  const values = bubble.allThinkingBlocks;
  const thought = jsonString(bubble.text) ?? '';

  // Older bubbles carry a single thought on the bubble itself.
  if (bubble.isThought === true && thought.length > 0) {
    return [{
      blockType: 'thinking',
      thinking: thought,
    }];
  }

  if (!isJsonArray(values)) {
    return [];
  }

  return values.flatMap((value) => {
    let text: string | undefined;

    if (typeof value === 'string') {
      text = value;
    }
    else if (isJsonObject(value)) {
      text = jsonString(value.text);
    }

    return text == null || text.length === 0
      ? []
      : [{
          blockType: 'thinking',
          thinking: text,
        }];
  });
};

// Cursor names its tools after its own commands, the viewer speaks the shared set.
const CURSOR_TOOL_NAMES = new Map<string, string>([
  ['read_file', 'Read'],
  ['view_file', 'Read'],
  ['write_to_file', 'Write'],
  ['create_file', 'Write'],
  ['edit_file', 'Write'],
  ['execute_command', 'Bash'],
  ['run_terminal_cmd', 'Bash'],
  ['list_directory', 'Glob'],
  ['list_dir', 'Glob'],
  ['search_files', 'Grep'],
  ['codebase_search', 'Grep'],
  ['grep_search', 'Grep'],
  ['web_search', 'WebSearch'],
  ['web_fetch', 'WebFetch'],
  ['fetch_url', 'WebFetch'],
]);

const cursorToolStatus = (status: string | undefined): ToolStatus => {
  return status === 'error' || status === 'rejected' ? 'error' : 'ok';
};

const cursorToolArguments = (rawArgs: string | undefined): RawToolInput => {
  const parsed = parseJsonContainer(rawArgs ?? '{}');

  return isJsonObject(parsed) ? (parsed) : {};
};

// Cursor keeps the call on the assistant bubble and its result in the same bubble's text.
const cursorToolParts = (
  bubble: JsonObject,
  bubbleId: string,
  text: string,
): CursorToolParts | undefined => {
  const data = objectAt(bubble, 'toolFormerData');

  if (data == null) {
    return undefined;
  }

  const name = CURSOR_TOOL_NAMES.get(jsonString(data.name) ?? '')
    ?? jsonString(data.name)
    ?? 'Tool';
  const toolUseId = jsonString(data.toolCallId) ?? bubbleId;

  return {
    block: {
      blockType: 'tool-use',
      call: {
        id: toolUseId,
        name,
        input: parseToolInput(name, cursorToolArguments(jsonString(data.rawArgs))),
      },
    },
    outcome: {
      toolUseId,
      status: cursorToolStatus(jsonString(data.status)),
      text: text.length > 0 ? text : undefined,
      images: [],
    },
  };
};

const cursorEntry = (
  header: CursorBubbleHeader,
  bubble: JsonObject,
  metadata: JsonObject,
  fallbackMs: number,
): readonly SqliteEntry[] => {
  const text = jsonString(bubble.text) ?? '';
  const rawTimestamp = jsonNumber(bubble.createdAt) ?? jsonNumber(metadata.createdAt) ?? fallbackMs;
  const timestamp = new Date(rawTimestamp).toISOString();

  if (header.type === 1) {
    const splitText = splitUserText(text);

    return [{
      kind: 'user',
      uuid: header.bubbleId,
      timestamp,
      sidechain: false,
      meta: splitText.meta,
      text: splitText.text,
      ...(splitText.injectedText == null ? {} : { injectedText: splitText.injectedText }),
      outcomes: [],
    }];
  }

  if (header.type !== 2) {
    return [];
  }

  const modelConfig = objectAt(metadata, 'modelConfig');
  const toolParts = cursorToolParts(bubble, header.bubbleId, text);
  const blocks: AssistantBlock[] = [...cursorThinkingBlocks(bubble)];

  if (toolParts != null) {
    blocks.push(toolParts.block);
  }
  else if (text.length > 0 && bubble.isThought !== true) {
    blocks.push({
      blockType: 'text',
      text,
    });
  }

  if (blocks.length === 0) {
    return [];
  }

  const assistant: SqliteEntry = {
    kind: 'assistant',
    uuid: header.bubbleId,
    timestamp,
    sidechain: false,
    model: modelConfig == null ? undefined : jsonString(modelConfig.modelName),
    blocks,
  };

  if (toolParts == null) {
    return [assistant];
  }

  // Outcomes ride on a user turn so pairToolOutcomes can link them to the call.
  return [assistant, {
    kind: 'user',
    uuid: `${header.bubbleId}-outcomes`,
    timestamp,
    sidechain: false,
    meta: false,
    text: '',
    outcomes: [toolParts.outcome],
  }];
};

const cursorWorkspace = (metadata: JsonObject, databasePath: string): string => {
  const identifier = objectAt(metadata, 'workspaceIdentifier');
  const uri = identifier == null ? undefined : objectAt(identifier, 'uri');

  return (uri == null ? undefined : jsonString(uri.fsPath)) ?? dirname(databasePath);
};

const cursorMetadataHeaders = (
  database: DatabaseSync,
  tables: ReadonlySet<string>,
): ReadonlyMap<string, JsonObject> => {
  const headers = new Map<string, JsonObject>();

  if (!tables.has('ItemTable')) {
    return headers;
  }

  const row = database.prepare("SELECT value FROM ItemTable WHERE key = 'composer.composerHeaders'").get();
  const value = parseJsonContainer(sqliteText(row?.value));
  const composers = isJsonObject(value) && isJsonArray(value.allComposers) ? value.allComposers : [];

  for (const composer of composers) {
    if (!isJsonObject(composer)) {
      continue;
    }

    const id = jsonString(composer.composerId);

    if (id != null) {
      headers.set(id, composer);
    }
  }

  return headers;
};

const cursorSessions = (
  database: DatabaseSync,
  databasePath: string,
  fallbackMs: number,
): readonly DecodedSqliteSession[] => {
  const tables = tableSet(database);

  if (!tables.has('cursorDiskKV')) {
    return [];
  }

  const rows = database.prepare(
    "SELECT key, value FROM cursorDiskKV WHERE key LIKE 'composerData:%' OR key LIKE 'bubbleId:%'",
  ).all();
  const headersById = cursorMetadataHeaders(database, tables);
  const metadataById = new Map<string, JsonObject>();
  const bubbleByKey = new Map<string, JsonObject>();

  for (const row of rows) {
    const key = sqliteText(row.key);
    const value = parseJsonContainer(sqliteText(row.value));

    if (!isJsonObject(value)) {
      continue;
    }

    if (key.startsWith('composerData:')) {
      metadataById.set(key.slice('composerData:'.length), value);
    }
    else {
      bubbleByKey.set(key, value);
    }
  }

  return [...metadataById].flatMap(([sessionId, metadata]) => {
    const header = headersById.get(sessionId);
    const merged = header == null
      ? metadata
      : {
          ...header,
          ...metadata,
        };
    const conversationMap = objectAt(merged, 'conversationMap');
    const headers = cursorBubbleHeaders(merged);
    const entries = headers.flatMap((header) => {
      const bubble = bubbleByKey.get(`bubbleId:${sessionId}:${header.bubbleId}`)
        ?? (conversationMap == null ? undefined : objectAt(conversationMap, header.bubbleId));
      return bubble == null ? [] : cursorEntry(header, bubble, merged, fallbackMs);
    });

    if (entries.length === 0) {
      return [];
    }

    return [{
      actualSessionId: sessionId,
      cwd: cursorWorkspace(merged, databasePath),
      entries,
      ...timestampRange(entries),
      title: jsonString(merged.name),
    }];
  });
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
 * llm/migrations.py). Synthesised into the generic role/content/timestamp shape.
 * The reply is timestamped after its duration, so sorting keeps prompt first.
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
 * Crush messages.parts is a discriminated union, not the flat text shape the
 * generic reader checks for. Only text parts are read: the others are real but
 * their field shapes are unverified, and rendering them wrong is worse.
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
      messageCount: sumBy(values, (value) => {
        return value.summary.messageCount;
      }),
      lastActivityMs: maxOf(values, (value) => {
        return value.summary.lastTimestampMs;
      }),
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
