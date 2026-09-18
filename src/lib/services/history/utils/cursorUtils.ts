import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import {
  isJsonArray,
  isJsonObject,
  objectAt,
  parseJsonContainer,
} from '@utils/jsonUtils';

import { parseToolInput, splitUserText } from '../../session/utils/parserUtils';

import {
  jsonNumber,
  jsonString,
  sqliteText,
  tableSet,
  timestampRange,
} from './sqliteSharedUtils';

import type {
  AssistantBlock,
  ToolOutcome,
  ToolStatus,
} from '@services/history/types';
import type { JsonObject } from '@utils/jsonUtils';
import type { RawToolInput } from './claudeRawUtils';
import type { DecodedSqliteSession, SqliteEntry } from './sqliteSharedUtils';

/*
 * Cursor keeps every composer in the one global `state.vscdb` under
 * `cursorDiskKV`, and which workspace claims which composer is a directory
 * over, so filing a session under its own folder means reading both stores.
 */

interface CursorBubbleHeader {
  readonly bubbleId: string;
  readonly type: number;
}

interface CursorToolParts {
  readonly block: AssistantBlock;
  readonly outcome: ToolOutcome;
}

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

const folderOf = (directory: string): string | undefined => {
  try {
    const parsed = parseJsonContainer(readFileSync(join(directory, 'workspace.json'), 'utf8'));
    const folder = isJsonObject(parsed) ? jsonString(parsed.folder) : undefined;

    return folder == null ? undefined : fileURLToPath(folder);
  }
  catch {
    return undefined;
  }
};

const composerIdsOf = (directory: string): readonly string[] => {
  try {
    const database = new DatabaseSync(join(directory, 'state.vscdb'), { readOnly: true });

    try {
      const row = database.prepare(
        "SELECT value FROM ItemTable WHERE key = 'composer.composerData'",
      ).get();
      const parsed = parseJsonContainer(sqliteText(row?.value));
      const ids = isJsonObject(parsed) ? parsed.selectedComposerIds : undefined;

      return isJsonArray(ids)
        ? ids.flatMap((id) => {
            const text = jsonString(id);

            return text == null ? [] : [text];
          })
        : [];
    }
    finally {
      database.close();
    }
  }
  catch {
    return [];
  }
};

/*
 * Cursor keeps every composer in the one global store and the folder it belongs
 * to in the workspace store beside it, joined by composer id. Without this every
 * session files itself under globalStorage, which is not a project anyone has.
 */
const cursorWorkspaceFolders = (databasePath: string): ReadonlyMap<string, string> => {
  const root = join(dirname(dirname(databasePath)), 'workspaceStorage');
  const folders = new Map<string, string>();

  let directories: readonly string[] = [];

  try {
    directories = readdirSync(root);
  }
  catch {
    return folders;
  }

  for (const entry of directories) {
    const directory = join(root, entry);
    const folder = folderOf(directory);

    if (folder != null) {
      for (const id of composerIdsOf(directory)) {
        folders.set(id, folder);
      }
    }
  }

  return folders;
};

const cursorWorkspace = (
  metadata: JsonObject,
  databasePath: string,
  composerId: string,
  folders: ReadonlyMap<string, string>,
): string => {
  const identifier = objectAt(metadata, 'workspaceIdentifier');
  const uri = identifier == null ? undefined : objectAt(identifier, 'uri');

  return (uri == null ? undefined : jsonString(uri.fsPath))
    ?? folders.get(composerId)
    ?? dirname(databasePath);
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

export const cursorSessions = (
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
  const folders = cursorWorkspaceFolders(databasePath);
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
      cwd: cursorWorkspace(merged, databasePath, sessionId, folders),
      entries,
      ...timestampRange(entries),
      title: jsonString(merged.name),
    }];
  });
};
