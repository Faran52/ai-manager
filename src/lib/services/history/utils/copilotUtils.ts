import { readdir, readFile } from 'node:fs/promises';
import {
  basename,
  dirname,
  join,
} from 'node:path';
import { fileURLToPath } from 'node:url';

import { appConfig } from '@config/appConfig';

import {
  isJsonArray,
  isJsonObject,
  parseJsonContainer,
} from '@utils/jsonUtils';
import { humanPreview } from '@utils/titleUtils';

import { parseToolInput, splitUserText } from '../../session/utils/parserUtils';

import { fileFactsStore } from './fileFactsUtils';
import { conversationMessageCount, firstUserMessageText } from './outcomeUtils';

import type { AgentId } from '@config/agents';
import type { JsonObject, JsonValue } from '@utils/jsonUtils';
import type {
  AssistantBlock,
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
  TodoItem,
  TokenUsage,
  ToolCall,
  ToolOutcome,
} from '../types';
import type { RawToolInput } from './claudeRawUtils';
import type { FileFacts } from './fileFactsUtils';

interface ToolInvocationParts {
  readonly call: ToolCall;
  readonly outcome: ToolOutcome;
}

interface ParsedCopilotHistory {
  readonly entries: readonly HistoryEntry[];
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
  readonly preview: string | undefined;
  readonly sessionId: string;
  readonly title: string | undefined;
}

// What a listing needs to know about a session file. The turns themselves are
// deliberately absent: they are the large part, and only the viewer reads them.
interface CopilotSessionFacts {
  readonly sessionId: string;
  readonly preview: string | undefined;
  readonly title: string | undefined;
  readonly messageCount: number;
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
}

interface CopilotFileSession extends CopilotSessionFacts, FileFacts {
  readonly filePath: string;
}

interface ReplayState {
  readonly requests: RequestDraft[];
  sessionId: string | undefined;
  title: string | undefined;
}

interface RequestDraft {
  completionTokens?: number;
  copilotCredits?: number;
  elapsedMs?: number;
  messageText: string | undefined;
  modelId: string | undefined;
  promptTokens?: number;
  requestId: string | undefined;
  readonly responseItems: JsonObject[];
  responseTimestamp?: number;
  resolvedModel: string | undefined;
  timestamp?: number;
}

// One file per session, so this covers a long history of them.
const CACHED_SESSIONS = 2_048;

const WORKSPACE_DEPTH = 3;
const CHAT_SESSIONS_DIR = 'chatSessions';

const REQUESTS_KEY = 'requests';
const RESPONSE_KEY = 'response';

const TOOL_NAMES = new Map<string, string>([
  ['copilot_readFile', 'Read'],
  ['copilot_replaceString', 'Edit'],
  ['copilot_multiReplaceString', 'MultiEdit'],
  ['run_in_terminal', 'Bash'],
  ['copilot_findFiles', 'Glob'],
  ['copilot_findTextInFiles', 'Grep'],
  ['copilot_fetchWebPage', 'WebFetch'],
  ['vscode_fetchWebPage_internal', 'WebFetch'],
  ['manage_todo_list', 'TodoWrite'],
]);

const LINK_PATTERN = /\]\(([^)\s]+)\)/u;
const INCLUDE_PATTERN = /\(`([^`]*)`\)/u;
const BACKTICK_PATTERN = /`([^`]*)`/gu;
const URL_PATTERN = /https?:\/\/[^\s`)\]]+/iu;
const FILE_URL_PREFIX = 'file://';

const fieldValue = (source: JsonValue | undefined, key: string): JsonValue | undefined => {
  return isJsonObject(source) ? source[key] : undefined;
};

const textIn = (source: JsonValue | undefined, key: string): string | undefined => {
  const value = fieldValue(source, key);

  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const plainString = (value: JsonValue | undefined): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const finiteNumber = (value: JsonValue | undefined): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const valuesIn = (source: JsonValue | undefined, key: string): readonly JsonValue[] => {
  const value = fieldValue(source, key);

  return isJsonArray(value) ? value : [];
};

// Chat markdown stores targets either inline or inside a `{value}` part record.
const chatText = (part: JsonValue | undefined): string => {
  if (typeof part === 'string') {
    return part;
  }

  const inner = fieldValue(part, 'value');

  return typeof inner === 'string' ? inner : '';
};

const chatTextIn = (item: JsonObject, key: string): string => {
  return chatText(item[key]);
};

const firstNonEmpty = (values: readonly string[]): string | undefined => {
  return values.find((value) => {
    return value.length > 0;
  });
};

const backtickGroup = (text: string, position: number): string | undefined => {
  return [...text.matchAll(BACKTICK_PATTERN)][position]?.[1];
};

const safeDecode = (raw: string): string | undefined => {
  try {
    return decodeURIComponent(raw);
  }
  catch {
    return undefined;
  }
};

const filePathCandidate = (href: string): string | undefined => {
  const stem = safeDecode(href) ?? href;

  if (!stem.startsWith(FILE_URL_PREFIX)) {
    return stem.length > 0 ? stem : undefined;
  }

  try {
    return fileURLToPath(stem);
  }
  catch {
    return undefined;
  }
};

const decodedLinkTarget = (text: string): string | undefined => {
  const href = LINK_PATTERN.exec(text)?.[1];

  if (href == null) {
    return undefined;
  }

  const hashIndex = href.indexOf('#');

  return filePathCandidate(hashIndex < 0 ? href : href.slice(0, hashIndex));
};

const fileFromMessages = (...candidates: readonly string[]): string | undefined => {
  return candidates.map((candidate) => {
    return decodedLinkTarget(candidate);
  }).find((target) => {
    return target != null && target.length > 0;
  });
};

const TRAILING_PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?', ')']);

// Scanning backwards keeps this linear, a trailing `[...]+$` regex backtracks.
const withoutTrailingPunctuation = (value: string): string => {
  let end = value.length;

  while (end > 0 && TRAILING_PUNCTUATION.has(value.charAt(end - 1))) {
    end -= 1;
  }

  return value.slice(0, end);
};

const webUrl = (text: string): string | undefined => {
  const matched = URL_PATTERN.exec(text)?.[0];
  const found = matched == null ? undefined : withoutTrailingPunctuation(matched);

  return found != null && found.length > 0 ? found : undefined;
};

const humanToolName = (toolId: string): string => {
  const spaced = toolId.replace(/^copilot_/u, '').replaceAll('_', ' ');
  const capitalized = `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;

  return capitalized.trim().length > 0 ? capitalized : 'Tool';
};

const callName = (toolId: string | undefined): string => {
  if (toolId == null) {
    return 'Tool';
  }

  return TOOL_NAMES.get(toolId) ?? humanToolName(toolId);
};

const terminalCommand = (item: JsonObject): string => {
  const data = fieldValue(item, 'toolSpecificData');
  const commandLine = fieldValue(data, 'commandLine');

  return firstNonEmpty([
    textIn(commandLine, 'original') ?? '',
    textIn(commandLine, 'toolEdited') ?? '',
    textIn(commandLine, 'forDisplay') ?? '',
  ]) ?? '';
};

const todoItems = (item: JsonObject): readonly TodoItem[] => {
  return valuesIn(fieldValue(item, 'toolSpecificData'), 'todoList').flatMap((record) => {
    const content = textIn(record, 'title') ?? textIn(record, 'id');

    return content == null
      ? []
      : [{
          content,
          status: textIn(record, 'status') ?? 'pending',
        }];
  });
};

const fetchUrl = (item: JsonObject): string => {
  const referenced = valuesIn(item, 'resultDetails')[0];

  return firstNonEmpty([
    webUrl(chatTextIn(item, 'invocationMessage')) ?? '',
    webUrl(chatTextIn(item, 'pastTenseMessage')) ?? '',
    textIn(referenced, 'external') ?? '',
    textIn(referenced, 'path') ?? '',
  ]) ?? '';
};

const rawInputFor = (toolId: string, item: JsonObject): RawToolInput => {
  const invocation = chatTextIn(item, 'invocationMessage');
  const pastTense = chatTextIn(item, 'pastTenseMessage');

  switch (toolId) {
    case 'copilot_readFile':
    case 'copilot_replaceString': {
      const filePath = fileFromMessages(invocation, pastTense);

      return filePath == null ? {} : { file_path: filePath };
    }
    case 'copilot_multiReplaceString':
      return {};
    case 'run_in_terminal':
      return { command: terminalCommand(item) };
    case 'copilot_findTextInFiles': {
      const include = INCLUDE_PATTERN.exec(invocation)?.[1]
        ?? backtickGroup(invocation, 1)
        ?? backtickGroup(pastTense, 1);
      const pattern = backtickGroup(invocation, 0) ?? '';

      return include == null
        ? { pattern }
        : {
            pattern,
            path: include,
          };
    }
    case 'copilot_findFiles': {
      const include = backtickGroup(invocation, 1);
      const pattern = backtickGroup(invocation, 0) ?? '';

      return include == null
        ? { pattern }
        : {
            pattern,
            path: include,
          };
    }
    case 'copilot_fetchWebPage':
    case 'vscode_fetchWebPage_internal':
      return { url: fetchUrl(item) };
    case 'manage_todo_list':
      return { todos: todoItems(item) };
    default: {
      const description = firstNonEmpty([pastTense, invocation]);

      return description == null ? {} : { description };
    }
  }
};

const invocationOf = (item: JsonObject, fallbackId: string): ToolInvocationParts => {
  const toolId = plainString(item.toolId);
  const name = callName(toolId);
  const pastTense = chatTextIn(item, 'pastTenseMessage');
  const invocation = chatTextIn(item, 'invocationMessage');
  const summary = firstNonEmpty([pastTense, invocation]);
  const extractedPath = fileFromMessages(invocation, pastTense);

  return {
    call: {
      id: plainString(item.toolCallId) ?? fallbackId,
      name,
      input: parseToolInput(name, rawInputFor(toolId ?? '', item)),
    },
    outcome: {
      toolUseId: plainString(item.toolCallId) ?? fallbackId,
      status: item.isComplete === true ? 'ok' : 'error',
      ...(summary == null ? {} : { text: summary }),
      images: [],
      ...(extractedPath == null ? {} : { filePath: extractedPath }),
    },
  };
};

const turnBlocks = (
  items: readonly JsonObject[],
  idPrefix: string,
): { readonly blocks: readonly AssistantBlock[];
  readonly outcomes: readonly ToolOutcome[]; } => {
  const blocks: AssistantBlock[] = [];
  const outcomes: ToolOutcome[] = [];
  let prose = '';
  let thought = '';

  const flushProse = (): void => {
    if (prose.trim().length > 0) {
      blocks.push({
        blockType: 'text',
        text: prose,
      });
    }

    prose = '';
  };

  const flushThought = (): void => {
    if (thought.trim().length > 0) {
      blocks.push({
        blockType: 'thinking',
        thinking: thought,
      });
    }

    thought = '';
  };

  const absorbThought = (value: string): void => {
    if (value.length === 0) {
      return;
    }

    if (thought.length > 0 && !value.startsWith(thought) && !thought.startsWith(value)) {
      thought = `${thought}\n\n${value}`;

      return;
    }

    thought = value.length > thought.length ? value : thought;
  };

  for (const item of items) {
    if (item.kind === 'thinking') {
      flushProse();
      absorbThought(chatTextIn(item, 'value'));

      continue;
    }

    if (typeof item.kind !== 'string') {
      flushThought();
      prose += chatTextIn(item, 'value');

      continue;
    }

    flushProse();
    flushThought();

    if (item.kind !== 'toolInvocationSerialized') {
      continue;
    }

    const { call, outcome } = invocationOf(item, `${idPrefix}-${String(blocks.length)}`);

    blocks.push({
      blockType: 'tool-use',
      call,
    });
    outcomes.push(outcome);
  }

  flushProse();
  flushThought();

  return {
    blocks,
    outcomes,
  };
};

const usageOf = (draft: RequestDraft): TokenUsage | undefined => {
  if (draft.promptTokens == null && draft.completionTokens == null) {
    return undefined;
  }

  return {
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    inputTokens: draft.promptTokens ?? 0,
    outputTokens: draft.completionTokens ?? 0,
  };
};

const absorbRequestField = (draft: RequestDraft, key: string, value: JsonValue): void => {
  switch (key) {
    case 'completionTokens': {
      const tokens = finiteNumber(value);

      if (tokens != null) {
        draft.completionTokens = tokens;
      }

      break;
    }
    case 'copilotCredits': {
      const credits = finiteNumber(value);

      if (credits != null) {
        draft.copilotCredits = credits;
      }

      break;
    }
    case 'elapsedMs': {
      const elapsed = finiteNumber(value);

      if (elapsed != null) {
        draft.elapsedMs = elapsed;
      }

      break;
    }
    case 'promptTokens': {
      const tokens = finiteNumber(value);

      if (tokens != null) {
        draft.promptTokens = tokens;
      }

      break;
    }
    case 'modelId':
      draft.modelId = plainString(value) ?? draft.modelId;
      break;
    case 'requestId':
      draft.requestId = plainString(value) ?? draft.requestId;
      break;
    case 'responseTimestamp': {
      const stamp = finiteNumber(value);

      if (stamp != null) {
        draft.responseTimestamp = stamp;
      }

      break;
    }
    case 'timestamp': {
      const stamp = finiteNumber(value);

      if (stamp != null) {
        draft.timestamp = stamp;
      }

      break;
    }
    case 'message': {
      const text = plainString(fieldValue(value, 'text'));

      if (text != null) {
        draft.messageText = text;
      }

      break;
    }
    case 'result':
      draft.resolvedModel = textIn(fieldValue(value, 'metadata'), 'resolvedModel') ?? draft.resolvedModel;
      break;
    default:
      break;
  }
};

const addDraft = (state: ReplayState, record: JsonObject): void => {
  const draft: RequestDraft = {
    messageText: undefined,
    modelId: undefined,
    requestId: undefined,
    resolvedModel: undefined,
    responseItems: [],
  };

  state.requests.push(draft);

  for (const [key, value] of Object.entries(record)) {
    if (key === RESPONSE_KEY && isJsonArray(value)) {
      for (const item of value) {
        if (isJsonObject(item)) {
          draft.responseItems.push(item);
        }
      }

      continue;
    }

    absorbRequestField(draft, key, value);
  }
};

const indexKeyOf = (value: JsonValue | undefined): number | undefined => {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
};

const appendResponses = (draft: RequestDraft, value: JsonValue): void => {
  if (!isJsonArray(value)) {
    return;
  }

  for (const item of value) {
    if (isJsonObject(item)) {
      draft.responseItems.push(item);
    }
  }
};

const applySetPatch = (state: ReplayState, keys: readonly JsonValue[], value: JsonValue): void => {
  if (keys[0] !== REQUESTS_KEY || keys.length !== 3) {
    return;
  }

  const index = indexKeyOf(keys[1]);
  const field = plainString(keys[2]);

  const draft = index == null ? undefined : state.requests[index];

  if (draft == null || field == null) {
    return;
  }

  absorbRequestField(draft, field, value);
};

const appendDrafts = (state: ReplayState, value: JsonValue): void => {
  if (!isJsonArray(value)) {
    return;
  }

  for (const record of value) {
    if (isJsonObject(record)) {
      addDraft(state, record);
    }
  }
};

const applyAppendPatch = (state: ReplayState, keys: readonly JsonValue[], value: JsonValue): void => {
  if (keys[0] !== REQUESTS_KEY) {
    return;
  }

  if (keys.length === 1) {
    appendDrafts(state, value);

    return;
  }

  if (keys.length !== 3 || keys[2] !== RESPONSE_KEY) {
    return;
  }

  const index = indexKeyOf(keys[1]);
  const draft = index == null ? undefined : state.requests[index];

  if (draft != null) {
    appendResponses(draft, value);
  }
};

const applyPatch = (state: ReplayState, patch: JsonObject): void => {
  const keys = patch.k;

  if (!isJsonArray(keys) || !(patch.kind === 1 || patch.kind === 2)) {
    return;
  }

  if (patch.kind === 1) {
    applySetPatch(state, keys, patch.v ?? null);

    return;
  }

  applyAppendPatch(state, keys, patch.v ?? []);
};

const applySnapshot = (state: ReplayState, record: JsonObject): void => {
  const sessionId = textIn(record, 'sessionId');
  const title = textIn(record, 'customTitle');

  if (sessionId != null) {
    state.sessionId = sessionId;
  }

  if (title != null) {
    state.title = title;
  }

  for (const request of valuesIn(record, REQUESTS_KEY)) {
    if (isJsonObject(request)) {
      addDraft(state, request);
    }
  }
};

const replayJournal = (content: string): ReplayState | undefined => {
  const state: ReplayState = {
    requests: [],
    sessionId: undefined,
    title: undefined,
  };
  let established = false;

  for (const line of content.split('\n')) {
    const parsed = parseJsonContainer(line);

    if (!isJsonObject(parsed)) {
      continue;
    }

    if (parsed.kind === 0) {
      const snapshot = parsed.v;

      if (!isJsonObject(snapshot)) {
        continue;
      }

      state.requests.length = 0;
      applySnapshot(state, snapshot);
      established = true;

      continue;
    }

    if (established) {
      applyPatch(state, parsed);
    }
  }

  return established ? state : undefined;
};

const entriesFromRequests = (
  requests: readonly RequestDraft[],
): { readonly entries: readonly HistoryEntry[];
  readonly firstMs: number;
  readonly lastMs: number; } => {
  const entries: HistoryEntry[] = [];
  let firstMs = Number.POSITIVE_INFINITY;
  let lastMs = 0;

  for (const [index, draft] of requests.entries()) {
    const uuid = draft.requestId ?? `request-${String(index)}`;
    const stamp = draft.timestamp ?? 0;
    const responseStamp = draft.responseTimestamp ?? stamp;

    firstMs = Math.min(firstMs, stamp, responseStamp);
    lastMs = Math.max(lastMs, stamp, responseStamp);

    if (draft.messageText != null) {
      const splitText = splitUserText(draft.messageText);

      entries.push({
        kind: 'user',
        uuid,
        timestamp: new Date(stamp).toISOString(),
        sidechain: false,
        meta: splitText.meta,
        text: splitText.text,
        ...(splitText.injectedText == null ? {} : { injectedText: splitText.injectedText }),
        outcomes: [],
      });
    }

    const { blocks, outcomes } = turnBlocks(draft.responseItems, uuid);

    entries.push({
      kind: 'assistant',
      uuid,
      timestamp: new Date(responseStamp).toISOString(),
      sidechain: false,
      model: draft.modelId ?? draft.resolvedModel,
      usage: usageOf(draft),
      costUsd: draft.copilotCredits,
      durationMs: draft.elapsedMs,
      blocks,
    });

    if (outcomes.length > 0) {
      entries.push({
        kind: 'user',
        uuid: `${uuid}-outcomes`,
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
    firstMs: Number.isFinite(firstMs) ? firstMs : 0,
    lastMs,
  };
};

export const parseCopilotHistory = (content: string): ParsedCopilotHistory | undefined => {
  const state = replayJournal(content);

  if (state == null) {
    return undefined;
  }

  const built = entriesFromRequests(state.requests);
  const previewText = firstUserMessageText(built.entries);

  return {
    entries: built.entries,
    firstTimestampMs: built.firstMs,
    lastTimestampMs: built.lastMs,
    preview: previewText == null ? undefined : humanPreview(previewText, appConfig.previewLength),
    sessionId: state.sessionId ?? '',
    title: state.title,
  };
};

const sessionFiles = async (root: string): Promise<readonly string[]> => {
  try {
    const dirents = await readdir(root, {
      recursive: true,
      withFileTypes: true,
    });

    return dirents.flatMap((dirent) => {
      if (!dirent.isFile() || !dirent.name.endsWith('.jsonl')) {
        return [];
      }

      const filePath = join(dirent.parentPath, dirent.name);

      return basename(dirname(filePath)) === CHAT_SESSIONS_DIR ? [filePath] : [];
    });
  }
  catch {
    return [];
  }
};

const copilotFacts = fileFactsStore<CopilotSessionFacts | undefined>(CACHED_SESSIONS);

const fileSession = async (filePath: string): Promise<CopilotFileSession | undefined> => {
  const facts = await copilotFacts(filePath, (content) => {
    const parsed = parseCopilotHistory(content);

    return parsed == null || parsed.entries.length === 0
      ? undefined
      : {
          sessionId: parsed.sessionId,
          preview: parsed.preview,
          title: parsed.title,
          messageCount: conversationMessageCount(parsed.entries),
          firstTimestampMs: parsed.firstTimestampMs,
          lastTimestampMs: parsed.lastTimestampMs,
        };
  });

  return facts?.sessionId == null
    ? undefined
    : {
        ...facts,
        sessionId: facts.sessionId,
        filePath,
      };
};

// VS Code keys chat storage by an opaque hash; the real folder lives in a record above it.
const workspaceRecordFolder = async (dir: string): Promise<string | undefined> => {
  try {
    const record = parseJsonContainer(await readFile(join(dir, 'workspace.json'), 'utf8'));
    const folder = isJsonObject(record) ? record.folder : undefined;

    return typeof folder === 'string' ? fileURLToPath(folder) : undefined;
  }
  catch {
    return undefined;
  }
};

const workspaceFolderFor = async (filePath: string): Promise<string | undefined> => {
  let dir = dirname(filePath);

  for (let level = 0; level < WORKSPACE_DEPTH; level += 1) {
    const folder = await workspaceRecordFolder(dir);

    if (folder != null) {
      return folder;
    }

    dir = dirname(dir);
  }

  return undefined;
};

export const listCopilotSessions = async (
  agent: AgentId,
  roots: readonly string[],
  projectId?: string,
): Promise<readonly SessionSummary[]> => {
  const summaries = await Promise.all(roots.map(async (root) => {
    const scanned = await Promise.all((await sessionFiles(root)).map(fileSession));

    return Promise.all(scanned.map(async (session) => {
      if (session == null) {
        return [];
      }

      const folder = await workspaceFolderFor(session.filePath);

      return [{
        agent,
        actualSessionId: session.sessionId.length > 0
          ? session.sessionId
          : basename(session.filePath, '.jsonl'),
        id: session.filePath,
        filePath: session.filePath,
        projectId: folder ?? 'unknown',
        preview: session.preview,
        title: session.title,
        messageCount: session.messageCount,
        firstTimestampMs: session.firstTimestampMs,
        lastTimestampMs: Math.max(session.lastTimestampMs, session.modifiedMs),
        modifiedMs: session.modifiedMs,
        sizeBytes: session.sizeBytes,
        cwd: folder,
      } satisfies SessionSummary];
    }));
  }));

  return summaries.flat(2).filter((summary) => {
    return projectId == null || summary.projectId === projectId;
  }).sort((left, right) => {
    return right.lastTimestampMs - left.lastTimestampMs;
  });
};

export const listCopilotProjects = async (
  agent: AgentId,
  roots: readonly string[],
): Promise<readonly ProjectSummary[]> => {
  const sessions = await listCopilotSessions(agent, roots);
  const grouped = new Map<string, SessionSummary[]>();

  for (const session of sessions) {
    const values = grouped.get(session.projectId) ?? [];

    values.push(session);
    grouped.set(session.projectId, values);
  }

  return [...grouped.entries()].map(([id, values]) => {
    const folder = values.find((value) => {
      return value.cwd != null;
    })?.cwd;

    return {
      agent,
      id,
      name: folder != null ? basename(folder) : 'Unknown project',
      actualPath: folder,
      sessionCount: values.length,
      messageCount: values.reduce((total, value) => {
        return total + value.messageCount;
      }, 0),
      lastActivityMs: values.reduce((latest, value) => {
        return Math.max(latest, value.lastTimestampMs);
      }, 0),
    } satisfies ProjectSummary;
  }).sort((left, right) => {
    return right.lastActivityMs - left.lastActivityMs;
  });
};

export const loadCopilotEntries = async (filePath: string): Promise<readonly HistoryEntry[] | undefined> => {
  try {
    return parseCopilotHistory(await readFile(filePath, 'utf8'))?.entries;
  }
  catch {
    return undefined;
  }
};
