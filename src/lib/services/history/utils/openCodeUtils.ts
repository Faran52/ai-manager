import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { appConfig } from '@config/appConfig';

import { truncate } from '@utils/formatUtils';
import { isJsonObject, parseJsonContainer } from '@utils/jsonUtils';
import { containedIn } from '@utils/pathUtils';
import { humanPreview, humanTitle } from '@utils/titleUtils';

import { parseToolInput, splitUserText } from '../../session/utils/parserUtils';

import { conversationMessageCount } from './outcomeUtils';
import { databaseFiles } from './sqliteUtils';

import type { AgentId } from '@config/agents';
import type { JsonObject } from '@utils/jsonUtils';
import type { SQLOutputValue } from 'node:sqlite';
import type {
  AssistantBlock,
  AssistantTurnEntry,
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
  ToolOutcome,
  ToolStatus,
} from '../types';
import type { RawToolInput } from './claudeRawUtils';

interface OpenCodeReference {
  readonly databasePath: string;
  readonly sessionId: string;
}

interface PartRow {
  readonly pid: string;
  readonly pdata: string | null;
}

interface SessionBuild {
  readonly entries: readonly HistoryEntry[];
  readonly messageCount: number;
  readonly firstMs: number;
  readonly lastMs: number;
  readonly preview: string | undefined;
}

const asString = (value: SQLOutputValue | undefined): string => {
  return typeof value === 'string' ? value : '';
};

const asNumber = (value: SQLOutputValue | undefined): number | null => {
  return typeof value === 'number' ? value : null;
};

const asText = (value: SQLOutputValue | undefined): string | null => {
  return typeof value === 'string' ? value : null;
};

const OPENCODE_PREFIX = 'oc:';
const MESSAGE_LIMIT = 20_000;
const PART_LIMIT = 60_000;

const encodeReference = (reference: OpenCodeReference): string => {
  return `${OPENCODE_PREFIX}${Buffer.from(JSON.stringify(reference)).toString('base64url')}`;
};

const decodeReference = (filePath: string): OpenCodeReference | undefined => {
  if (!filePath.startsWith(OPENCODE_PREFIX)) {
    return undefined;
  }

  try {
    const value: unknown = JSON.parse(Buffer.from(filePath.slice(OPENCODE_PREFIX.length), 'base64url').toString());

    if (typeof value !== 'object' || value === null
      || !('databasePath' in value) || typeof value.databasePath !== 'string'
      || !('sessionId' in value) || typeof value.sessionId !== 'string') {
      return undefined;
    }

    return {
      databasePath: value.databasePath,
      sessionId: value.sessionId,
    };
  }
  catch {
    return undefined;
  }
};

const EMPTY_PAYLOAD: JsonObject = {};

const payloadOf = (raw: string | null): JsonObject => {
  if (raw == null) {
    return EMPTY_PAYLOAD;
  }

  const parsed = parseJsonContainer(raw);

  return isJsonObject(parsed) ? parsed : EMPTY_PAYLOAD;
};

const textAt = (payload: JsonObject): string => {
  const value = payload.text;

  return typeof value === 'string' ? value : '';
};

const statusOf = (state: JsonObject): ToolStatus => {
  const status = state.status;

  if (status === 'error') {
    return 'error';
  }

  return status === 'completed' ? 'ok' : 'interrupted';
};

const outputText = (state: JsonObject): string | undefined => {
  const output = state.output;

  if (typeof output === 'string') {
    return output.length > 0 ? output : undefined;
  }

  if (typeof output === 'number') {
    return output.toString();
  }

  if (isJsonObject(output)) {
    return typeof output.text === 'string' ? output.text : JSON.stringify(output);
  }

  return undefined;
};

const outcomeFromPart = (callId: string, state: JsonObject): ToolOutcome => {
  return {
    toolUseId: callId,
    status: statusOf(state),
    text: outputText(state),
    images: [],
  };
};

const CANONICAL_TOOLS = new Map<string, string>([
  ['bash', 'Bash'],
  ['write', 'Write'],
  ['edit', 'Edit'],
  ['patch', 'MultiEdit'],
  ['multi-edit', 'MultiEdit'],
  ['multiedit', 'MultiEdit'],
  ['read', 'Read'],
  ['glob', 'Glob'],
  ['grep', 'Grep'],
  ['websearch', 'WebSearch'],
  ['webfetch', 'WebFetch'],
  ['todowrite', 'TodoWrite'],
  ['task', 'Task'],
  ['agent', 'Agent'],
]);

const stringField = (payload: JsonObject, key: string): string | undefined => {
  const value = payload[key];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const optionalString = (payload: JsonObject, key: string): string | undefined => {
  const value = payload[key];

  return typeof value === 'string' ? value : undefined;
};

const optionalNumber = (payload: JsonObject, key: string): number | undefined => {
  const value = payload[key];

  return typeof value === 'number' ? value : undefined;
};

const usageFromMessage = (payload: JsonObject): AssistantTurnEntry['usage'] => {
  const tokens = isJsonObject(payload.tokens) ? payload.tokens : undefined;

  if (tokens == null) {
    return undefined;
  }

  const cache = isJsonObject(tokens.cache) ? tokens.cache : EMPTY_PAYLOAD;

  return {
    inputTokens: optionalNumber(tokens, 'input') ?? 0,
    outputTokens: optionalNumber(tokens, 'output') ?? 0,
    cacheCreationTokens: optionalNumber(cache, 'write') ?? 0,
    cacheReadTokens: optionalNumber(cache, 'read') ?? 0,
  };
};

const rawInputOf = (state: JsonObject): RawToolInput => {
  const input: RawToolInput = Object.fromEntries(
    Object.entries({
      command: optionalString(state, 'command'),
      description: optionalString(state, 'description'),
      file_path: optionalString(state, 'file_path'),
      path: optionalString(state, 'path'),
      pattern: optionalString(state, 'pattern'),
      glob: optionalString(state, 'glob'),
      query: optionalString(state, 'query'),
      url: optionalString(state, 'url'),
      prompt: optionalString(state, 'prompt'),
      old_string: optionalString(state, 'old_string'),
      new_string: optionalString(state, 'new_string'),
      replace_all: state.replace_all === true ? true : undefined,
      content: optionalString(state, 'content'),
      skill: optionalString(state, 'skill'),
      subagent_type: optionalString(state, 'subagent_type'),
      todos: Array.isArray(state.todos) ? state.todos : undefined,
      edits: Array.isArray(state.edits) ? state.edits : undefined,
      limit: typeof state.limit === 'number' ? state.limit : undefined,
      offset: typeof state.offset === 'number' ? state.offset : undefined,
    }).filter((entry) => {
      return entry[1] !== undefined;
    }),
  );

  return input;
};

const blockFromPart = (part: JsonObject, callId: string): AssistantBlock => {
  const tool = stringField(part, 'tool') ?? 'tool';
  const state = isJsonObject(part.state) ? part.state : EMPTY_PAYLOAD;
  const input = isJsonObject(state.input) ? state.input : EMPTY_PAYLOAD;

  return {
    blockType: 'tool-use',
    call: {
      id: callId,
      name: tool,
      input: parseToolInput(CANONICAL_TOOLS.get(tool.toLowerCase()) ?? tool, rawInputOf(input)),
    },
  };
};

const partsFor = (database: DatabaseSync, messageId: string): readonly PartRow[] => {
  const rows = database.prepare(
    'SELECT id AS pid, data AS pdata FROM part WHERE message_id = ?'
    + ' ORDER BY time_created ASC, id ASC LIMIT '
    + String(PART_LIMIT),
  ).all(messageId);

  return rows.map((row) => {
    return {
      pid: asString(row.pid),
      pdata: asText(row.pdata),
    };
  });
};

const userTextFrom = (parts: readonly PartRow[]): string => {
  return parts.map((part) => {
    const parsed = payloadOf(part.pdata);

    return parsed.type === 'text' ? textAt(parsed) : '';
  }).filter(Boolean).join('\n\n');
};

const assistantBlocksFrom = (
  parts: readonly PartRow[],
): { readonly blocks: readonly AssistantBlock[];
  readonly outcomes: readonly ToolOutcome[]; } => {
  const blocks: AssistantBlock[] = [];
  const outcomes: ToolOutcome[] = [];

  for (const part of parts) {
    const parsed = payloadOf(part.pdata);

    if (parsed.type === 'text' && textAt(parsed).length > 0) {
      blocks.push({
        blockType: 'text',
        text: textAt(parsed),
      });
    }
    else if (parsed.type === 'reasoning') {
      blocks.push({
        blockType: 'thinking',
        thinking: textAt(parsed),
      });
    }
    else if (parsed.type === 'tool') {
      const callId = stringField(parsed, 'callID') ?? part.pid;
      const state = isJsonObject(parsed.state) ? parsed.state : EMPTY_PAYLOAD;

      blocks.push(blockFromPart(parsed, callId));

      if (state.status !== 'pending') {
        outcomes.push(outcomeFromPart(callId, state));
      }
    }
  }

  return {
    blocks,
    outcomes,
  };
};

const buildSession = (database: DatabaseSync, sessionId: string): SessionBuild => {
  const messages = database.prepare(
    'SELECT id AS mid, time_created AS mtime, data AS mdata FROM message'
    + ' WHERE session_id = ? ORDER BY time_created ASC LIMIT '
    + String(MESSAGE_LIMIT),
  ).all(sessionId).map((row) => {
    return {
      mid: asString(row.mid),
      mtime: asNumber(row.mtime),
      mdata: asText(row.mdata),
    };
  });

  const entries: HistoryEntry[] = [];
  let firstMs = Number.POSITIVE_INFINITY;
  let lastMs = 0;
  let preview: string | undefined;

  for (const message of messages) {
    const payload = payloadOf(message.mdata);
    const stamp = message.mtime ?? 0;

    firstMs = Math.min(firstMs, stamp);
    lastMs = Math.max(lastMs, stamp);

    const parts = partsFor(database, message.mid);

    if (payload.role === 'user') {
      const text = userTextFrom(parts);
      const splitText = splitUserText(text);

      if (!splitText.meta && preview == null) {
        preview = humanPreview(splitText.text, appConfig.previewLength);
      }

      entries.push({
        kind: 'user',
        uuid: message.mid,
        timestamp: new Date(stamp).toISOString(),
        sidechain: false,
        meta: splitText.meta,
        text: splitText.text,
        ...(splitText.injectedText == null ? {} : { injectedText: splitText.injectedText }),
        outcomes: [],
      });

      continue;
    }

    if (payload.role !== 'assistant') {
      continue;
    }

    const { blocks, outcomes } = assistantBlocksFrom(parts);

    entries.push({
      kind: 'assistant',
      uuid: message.mid,
      timestamp: new Date(stamp).toISOString(),
      sidechain: false,
      model: stringField(payload, 'modelID'),
      stopReason: stringField(payload, 'finish'),
      usage: usageFromMessage(payload),
      costUsd: optionalNumber(payload, 'cost'),
      blocks,
    });

    if (outcomes.length > 0) {
      entries.push({
        kind: 'user',
        uuid: `${message.mid}-outcomes`,
        timestamp: new Date(stamp).toISOString(),
        sidechain: false,
        meta: true,
        text: '',
        outcomes,
      });
    }
  }

  return {
    entries,
    messageCount: conversationMessageCount(entries),
    firstMs,
    lastMs,
    preview,
  };
};

const previewFor = (
  built: SessionBuild,
  directory: string,
): string | undefined => {
  if (built.preview != null) {
    return built.preview;
  }

  const name = basename(directory);

  return name.length > 0 ? truncate(name, appConfig.previewLength) : undefined;
};

const titleFor = (stored: string | null, built: SessionBuild): string | undefined => {
  return humanTitle(stored) ?? built.preview;
};

const sessionsFromDatabase = async (
  agent: AgentId,
  databasePath: string,
): Promise<readonly SessionSummary[]> => {
  let database: DatabaseSync | undefined;

  try {
    const info = await stat(databasePath);

    const opened = new DatabaseSync(databasePath, { readOnly: true });

    database = opened;

    const rows = opened.prepare(
      'SELECT id, title, directory, time_created, time_updated FROM session'
      + ' ORDER BY time_updated DESC',
    ).all();

    return rows.flatMap((raw) => {
      const row = {
        id: asString(raw.id),
        title: asText(raw.title),
        directory: asText(raw.directory),
        time_created: asNumber(raw.time_created),
        time_updated: asNumber(raw.time_updated),
      };
      const built = buildSession(opened, row.id);

      if (built.entries.length === 0) {
        return [];
      }

      const directory = row.directory ?? '';
      const summary: SessionSummary = {
        agent,
        actualSessionId: row.id,
        id: `${basename(databasePath)}:${row.id}`,
        filePath: encodeReference({
          databasePath,
          sessionId: row.id,
        }),
        projectId: directory,
        title: titleFor(row.title, built),
        preview: previewFor(built, directory),
        messageCount: built.messageCount,
        firstTimestampMs: built.firstMs,
        // No mtime fold: one database holds every session, so its mtime moves
        // whenever any of them does. `time_updated` is the per-session equivalent.
        lastTimestampMs: Math.max(built.lastMs, row.time_updated ?? 0),
        modifiedMs: info.mtimeMs,
        sizeBytes: info.size,
        cwd: directory.length > 0 ? directory : undefined,
      };

      return [summary];
    });
  }
  catch {
    return [];
  }
  finally {
    database?.close();
  }
};

const scanSessions = async (
  agent: AgentId,
  roots: readonly string[],
): Promise<readonly SessionSummary[]> => {
  const sessions: SessionSummary[] = [];

  for (const root of roots) {
    for (const databasePath of await databaseFiles(root, 2)) {
      sessions.push(...await sessionsFromDatabase(agent, databasePath));
    }
  }

  return sessions.sort((left, right) => {
    return right.lastTimestampMs - left.lastTimestampMs;
  });
};

export const listOpenCodeProjects = async (
  agent: AgentId,
  roots: readonly string[],
): Promise<readonly ProjectSummary[]> => {
  const sessions = await scanSessions(agent, roots);
  const grouped = new Map<string, SessionSummary[]>();

  for (const session of sessions) {
    const values = grouped.get(session.projectId) ?? [];

    values.push(session);
    grouped.set(session.projectId, values);
  }

  return [...grouped.entries()].map(([id, values]) => {
    const cwd = values.find((value) => {
      return value.cwd != null;
    })?.cwd;

    return {
      agent,
      id,
      name: cwd != null ? basename(cwd) : basename(id),
      actualPath: cwd,
      sessionCount: values.length,
      messageCount: values.reduce((total, value) => {
        return total + value.messageCount;
      }, 0),
      lastActivityMs: values.reduce((latest, value) => {
        return Math.max(latest, value.lastTimestampMs);
      }, 0),
    };
  }).sort((left, right) => {
    return right.lastActivityMs - left.lastActivityMs;
  });
};

export const listOpenCodeSessions = async (
  agent: AgentId,
  roots: readonly string[],
  projectId?: string,
): Promise<readonly SessionSummary[]> => {
  const sessions = await scanSessions(agent, roots);

  return sessions.filter((session) => {
    return projectId == null || session.projectId === projectId;
  });
};

// The one write path into an OpenCode database: every other open stays readOnly.
// Stat first because a read-write open would silently create a missing file.
export const deleteOpenCodeSession = async (
  filePath: string,
  allowedRoots: readonly string[],
): Promise<void> => {
  const reference = decodeReference(filePath);

  if (reference == null) {
    throw new Error('This is not a usable OpenCode session reference.');
  }

  if (!await containedIn(allowedRoots, reference.databasePath)) {
    throw new Error('The session database is outside its agent history directory.');
  }

  await stat(reference.databasePath);

  const database = new DatabaseSync(reference.databasePath);

  try {
    database.exec('BEGIN');
    database.prepare('DELETE FROM part WHERE session_id = ?').run(reference.sessionId);
    database.prepare('DELETE FROM message WHERE session_id = ?').run(reference.sessionId);
    database.prepare('DELETE FROM session WHERE id = ?').run(reference.sessionId);
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

export const loadOpenCodeEntries = async (
  filePath: string,
  allowedRoots?: readonly string[],
): Promise<readonly HistoryEntry[] | undefined> => {
  const reference = decodeReference(filePath);

  if (reference == null || (allowedRoots != null && !await containedIn(allowedRoots, reference.databasePath))) {
    return undefined;
  }

  let database: DatabaseSync | undefined;

  try {
    const opened = new DatabaseSync(reference.databasePath, { readOnly: true });

    database = opened;

    return buildSession(opened, reference.sessionId).entries;
  }
  catch {
    return undefined;
  }
  finally {
    database?.close();
  }
};
