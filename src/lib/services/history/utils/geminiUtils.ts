import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';
import { join } from 'node:path';

import { appConfig } from '@config/appConfig';

import {
  isJsonArray,
  isJsonObject,
  parseJsonContainer,
  textAt,
} from '@utils/jsonUtils';
import { humanPreview } from '@utils/titleUtils';

import { parseToolInput, splitUserText } from '../../session/utils/parserUtils';

import { conversationMessageCount, firstUserMessageText } from './outcomeUtils';
import { namedByFolder, projectsFromSessions } from './projectSummaryUtils';

import type { AgentId } from '@config/agents';
import type { JsonObject, JsonValue } from '@utils/jsonUtils';
import type {
  AssistantBlock,
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
  ToolOutcome,
  ToolParts,
} from '../types';
import type { RawToolInput } from './claudeRawUtils';

type GeminiEntry = Exclude<HistoryEntry, { kind: 'summary' }>;

interface ParsedGeminiHistory {
  readonly entries: readonly GeminiEntry[];
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
  readonly preview: string | undefined;
  readonly sessionId: string;
}

interface GeminiFileSession extends ParsedGeminiHistory {
  readonly cwd: string | undefined;
  readonly filePath: string;
  readonly modifiedMs: number;
  readonly sizeBytes: number;
}

interface ChatRecords {
  meta: JsonObject;
  messages: readonly JsonObject[];
}

interface SessionFileRef {
  dir: string;
  file: string;
}

const CHATS_DIR = 'chats';
const PROJECT_ROOT_FILE = '.project_root';
const SESSION_PREFIX = 'session-';

// Gemini renames its tools between releases; the viewer speaks the shared set.
const TOOL_NAMES = new Map<string, string>([
  ['read_file', 'Read'],
  ['ReadFile', 'Read'],
  ['write_file', 'Write'],
  ['WriteFile', 'Write'],
  ['create_file', 'Write'],
  ['edit_file', 'Edit'],
  ['EditFile', 'Edit'],
  ['shell', 'Bash'],
  ['run_command', 'Bash'],
  ['execute_command', 'Bash'],
  ['list_directory', 'Glob'],
  ['list_dir', 'Glob'],
  ['search_files', 'Grep'],
  ['grep', 'Grep'],
  ['web_search', 'WebSearch'],
  ['web_fetch', 'WebFetch'],
]);

const stampOf = (value: JsonValue | undefined): number | undefined => {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);

    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return typeof value === 'number' ? value : undefined;
};

// A Part is either plain text or a nested `{ text }`, per PartListUnion.
const partText = (part: JsonValue | undefined): string => {
  if (typeof part === 'string') {
    return part;
  }

  return textAt(part, 'text') ?? '';
};

const contentText = (content: JsonValue | undefined): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (!isJsonArray(content)) {
    return '';
  }

  const texts = content.map(partText).filter((text) => {
    return text.length > 0;
  });

  return texts.join('\n');
};

const thinkingBlocks = (record: JsonObject): readonly AssistantBlock[] => {
  const thoughts = record.thoughts;

  if (!isJsonArray(thoughts)) {
    return [];
  }

  return thoughts.flatMap((thought) => {
    const subject = textAt(thought, 'subject');
    const description = textAt(thought, 'description') ?? '';
    const thinking = subject == null ? description : `**${subject}**\n${description}`;

    return thinking.length === 0
      ? []
      : [{
        blockType: 'thinking',
        thinking,
      } satisfies AssistantBlock];
  });
};

const rawInputOf = (args: JsonValue | undefined): RawToolInput => {
  return isJsonObject(args) ? (args) : {};
};

const outcomeTextOf = (result: JsonValue | undefined): string | undefined => {
  if (typeof result === 'string') {
    return result;
  }

  return textAt(result, 'output')
    ?? textAt(result, 'content')
    ?? textAt(result, 'text')
    ?? (result == null ? undefined : JSON.stringify(result));
};

const toolPartsOf = (record: JsonObject, fallbackId: string): ToolParts => {
  const calls = record.toolCalls;

  if (!isJsonArray(calls)) {
    return {
      blocks: [],
      outcomes: [],
    };
  }

  const blocks: AssistantBlock[] = [];
  const outcomes: ToolOutcome[] = [];

  for (const [index, call] of calls.entries()) {
    if (!isJsonObject(call)) {
      continue;
    }

    const rawName = textAt(call, 'name') ?? 'Tool';
    const name = TOOL_NAMES.get(rawName) ?? rawName;
    const toolUseId = textAt(call, 'id') ?? `${fallbackId}-tool-${String(index)}`;

    blocks.push({
      blockType: 'tool-use',
      call: {
        id: toolUseId,
        name,
        input: parseToolInput(name, rawInputOf(call.args)),
      },
    });

    if (call.result === undefined) {
      continue;
    }

    outcomes.push({
      toolUseId,
      status: textAt(call, 'status') === 'error' ? 'error' : 'ok',
      text: outcomeTextOf(call.result),
      images: [],
    });
  }

  return {
    blocks,
    outcomes,
  };
};

/*
 * Gemini CLI moved from one .json object carrying a messages array to an
 * append-only .jsonl log whose first line is metadata, with $set lines updating
 * it. Both shapes still exist on disk.
 */
const readRecords = (content: string): ChatRecords => {
  const whole = parseJsonContainer(content);

  if (isJsonObject(whole) && isJsonArray(whole.messages)) {
    return {
      meta: whole,
      messages: whole.messages.filter(isJsonObject),
    };
  }

  const meta: JsonObject = {};
  const messages: JsonObject[] = [];

  for (const line of content.split('\n')) {
    const record = parseJsonContainer(line);

    if (!isJsonObject(record)) {
      continue;
    }

    const update = record.$set;

    if (isJsonObject(update)) {
      Object.assign(meta, update);
      continue;
    }

    if (record.$rewindTo !== undefined) {
      continue;
    }

    if (typeof record.sessionId === 'string' && messages.length === 0) {
      Object.assign(meta, record);
      continue;
    }

    if (typeof record.type === 'string') {
      messages.push(record);
    }
  }

  return {
    meta,
    messages,
  };
};

const entryOf = (
  record: JsonObject,
  index: number,
  fallbackMs: number,
): readonly GeminiEntry[] => {
  const kind = textAt(record, 'type');
  const uuid = textAt(record, 'id') ?? `entry-${String(index)}`;
  const stamp = stampOf(record.timestamp) ?? fallbackMs;
  const timestamp = new Date(stamp).toISOString();
  const text = contentText(record.content);

  if (kind === 'user') {
    const split = splitUserText(text);

    return [{
      kind: 'user',
      uuid,
      timestamp,
      sidechain: false,
      meta: split.meta,
      text: split.text,
      ...(split.injectedText == null ? {} : { injectedText: split.injectedText }),
      outcomes: [],
    }];
  }

  if (kind === 'info' || kind === 'warning' || kind === 'error') {
    return text.length === 0
      ? []
      : [{
          kind: 'system',
          uuid,
          timestamp,
          sidechain: false,
          text,
        }];
  }

  if (kind !== 'gemini') {
    return [];
  }

  const tools = toolPartsOf(record, uuid);
  const blocks: AssistantBlock[] = [...thinkingBlocks(record)];

  if (text.length > 0) {
    blocks.push({
      blockType: 'text',
      text,
    });
  }

  blocks.push(...tools.blocks);

  if (blocks.length === 0) {
    return [];
  }

  const assistant: GeminiEntry = {
    kind: 'assistant',
    uuid,
    timestamp,
    sidechain: false,
    model: textAt(record, 'model'),
    blocks,
  };

  if (tools.outcomes.length === 0) {
    return [assistant];
  }

  // Outcomes ride on a user turn so pairToolOutcomes can link them to the call.
  return [assistant, {
    kind: 'user',
    uuid: `${uuid}-outcomes`,
    timestamp,
    sidechain: false,
    meta: false,
    text: '',
    outcomes: tools.outcomes,
  }];
};

export const parseGeminiHistory = (
  content: string,
  fallbackMs: number,
): ParsedGeminiHistory | undefined => {
  const { meta, messages } = readRecords(content);

  if (messages.length === 0) {
    return undefined;
  }

  const entries = messages.flatMap((record, index) => {
    return entryOf(record, index, fallbackMs);
  });

  if (entries.length === 0) {
    return undefined;
  }

  // Every entry above stamps itself, falling back to the file's own time.
  const stamps = entries.map((entry) => {
    return Date.parse(entry.timestamp);
  });

  return {
    entries,
    sessionId: textAt(meta, 'sessionId') ?? 'gemini-session',
    preview: firstUserMessageText(entries),
    firstTimestampMs: Math.min(...stamps),
    lastTimestampMs: Math.max(...stamps),
  };
};

const isSessionFile = (name: string): boolean => {
  const lower = name.toLowerCase();

  return name.startsWith(SESSION_PREFIX) && (lower.endsWith('.json') || lower.endsWith('.jsonl'));
};

const projectRootOf = async (projectDir: string): Promise<string | undefined> => {
  try {
    const value = (await readFile(join(projectDir, PROJECT_ROOT_FILE), 'utf8')).trim();

    return value.length === 0 ? undefined : value;
  }
  catch {
    return undefined;
  }
};

const sessionFilesIn = async (root: string): Promise<readonly SessionFileRef[]> => {
  try {
    const projects = await readdir(root, { withFileTypes: true });
    const found: SessionFileRef[] = [];

    for (const project of projects) {
      if (!project.isDirectory()) {
        continue;
      }

      const projectDir = join(root, project.name);

      try {
        for (const entry of await readdir(join(projectDir, CHATS_DIR), { withFileTypes: true })) {
          if (entry.isFile() && isSessionFile(entry.name)) {
            found.push({
              dir: projectDir,
              file: join(projectDir, CHATS_DIR, entry.name),
            });
          }
        }
      }
      catch {
        continue;
      }
    }

    return found;
  }
  catch {
    return [];
  }
};

const fileSessionOf = async (
  dir: string,
  filePath: string,
): Promise<GeminiFileSession | undefined> => {
  try {
    const [content, facts] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)]);
    const parsed = parseGeminiHistory(content, facts.mtimeMs);

    if (parsed == null) {
      return undefined;
    }

    return {
      ...parsed,
      cwd: await projectRootOf(dir),
      filePath,
      // Appended as the session runs, so mtime is activity the newest entry can
      // predate. Every file-per-session agent folds it in, or ordering diverges.
      lastTimestampMs: Math.max(parsed.lastTimestampMs, facts.mtimeMs),
      modifiedMs: facts.mtimeMs,
      sizeBytes: facts.size,
    };
  }
  catch {
    return undefined;
  }
};

const scanSessions = async (roots: readonly string[]): Promise<readonly GeminiFileSession[]> => {
  const found = (await Promise.all(roots.map(sessionFilesIn))).flat();
  const sessions = await Promise.all(found.map(async ({ dir, file }) => {
    return fileSessionOf(dir, file);
  }));

  return sessions.filter((session): session is GeminiFileSession => {
    return session != null;
  });
};

const projectIdOf = (session: GeminiFileSession): string => {
  return session.cwd ?? 'unknown';
};

const summaryOf = (agent: AgentId, session: GeminiFileSession): SessionSummary => {
  return {
    agent,
    id: session.sessionId,
    actualSessionId: session.sessionId,
    filePath: session.filePath,
    projectId: projectIdOf(session),
    preview: session.preview == null
      ? undefined
      : humanPreview(session.preview, appConfig.previewLength),
    messageCount: conversationMessageCount(session.entries),
    firstTimestampMs: session.firstTimestampMs,
    lastTimestampMs: session.lastTimestampMs,
    modifiedMs: session.modifiedMs,
    sizeBytes: session.sizeBytes,
    cwd: session.cwd,
  };
};

export const listGeminiSessions = async (
  agent: AgentId,
  roots: readonly string[],
  projectId?: string,
): Promise<readonly SessionSummary[]> => {
  const sessions = await scanSessions(roots);

  const inProject = sessions.filter((session) => {
    return projectId == null || projectIdOf(session) === projectId;
  });
  const summaries = inProject.map((session) => {
    return summaryOf(agent, session);
  });

  return summaries.sort((left, right) => {
    return right.lastTimestampMs - left.lastTimestampMs;
  });
};

export const listGeminiProjects = async (
  agent: AgentId,
  roots: readonly string[],
): Promise<readonly ProjectSummary[]> => {
  const sessions = await scanSessions(roots);
  const summaries = sessions.map((session) => {
    return summaryOf(agent, session);
  });

  return projectsFromSessions(agent, summaries, namedByFolder('Unknown project'));
};

export const loadGeminiEntries = async (
  filePath: string,
): Promise<readonly HistoryEntry[] | undefined> => {
  try {
    const facts = await stat(filePath);

    return parseGeminiHistory(await readFile(filePath, 'utf8'), facts.mtimeMs)?.entries;
  }
  catch {
    return undefined;
  }
};
