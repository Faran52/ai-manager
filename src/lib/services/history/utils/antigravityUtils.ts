/**
 * Antigravity CLI, whose on-disk shape is reverse engineered rather than
 * documented by the vendor, so every step here is best effort: a malformed line
 * or an unknown enum value is skipped rather than failing the session.
 *
 * ```text
 * ~/.gemini/antigravity-cli/
 * ├── history.jsonl                 one line per prompt, the conversation index
 * └── brain/<conversation-uuid>/
 *     └── .system_generated/logs/transcript_full.jsonl
 * ```
 *
 * The store holds more than this (`conversations/<uuid>.db` protobuf SQLite,
 * `implicit/*.pb`, `scratch/`). None of it is read, deliberately.
 *
 * This covers the CLI only. Antigravity desktop keeps a separate store under
 * `~/.gemini/antigravity/`, read by `antigravityDesktopUtils` and merged into
 * the three readers below.
 */
import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';
import { basename, join } from 'node:path';

import { appConfig } from '@config/appConfig';

import { isJsonObject, parseJsonContainer } from '@utils/jsonUtils';
import { humanPreview } from '@utils/titleUtils';

import { splitUserText } from '../../session/utils/parserUtils';

import {
  listAntigravityDesktopProjects,
  listAntigravityDesktopSessions,
  loadAntigravityDesktopEntries,
} from './antigravityDesktopUtils';
import { conversationMessageCount, firstUserMessageText } from './outcomeUtils';

import type { AgentId } from '@config/agents';
import type { JsonObject } from '@utils/jsonUtils';
import type {
  AssistantBlock,
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
} from '../types';

type AntigravityEntry = Exclude<HistoryEntry, { kind: 'summary' }>;

interface ConversationIndexEntry {
  readonly display: string | undefined;
  readonly timestampMs: number | undefined;
  readonly workspace: string | undefined;
}

interface AntigravitySession {
  readonly conversationId: string;
  readonly entries: readonly AntigravityEntry[];
  readonly filePath: string;
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
  readonly modifiedMs: number;
  readonly preview: string | undefined;
  readonly sizeBytes: number;
  readonly title: string | undefined;
  readonly workspace: string | undefined;
}

const HISTORY_FILE = 'history.jsonl';
const BRAIN_DIR = 'brain';
const TRANSCRIPT = join('.system_generated', 'logs', 'transcript_full.jsonl');
const UNPLACED = 'unplaced';

const textIn = (source: JsonObject, key: string): string | undefined => {
  const value = source[key];

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const numberIn = (source: JsonObject, key: string): number | undefined => {
  const value = source[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const isoOf = (value: string | undefined): number | undefined => {
  if (value == null) {
    return undefined;
  }

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? undefined : parsed;
};

// The index places a conversation in a workspace and names it.
const readIndex = async (root: string): Promise<ReadonlyMap<string, ConversationIndexEntry>> => {
  const index = new Map<string, ConversationIndexEntry>();

  try {
    const content = await readFile(join(root, HISTORY_FILE), 'utf8');

    for (const line of content.split('\n')) {
      const record = parseJsonContainer(line);

      if (!isJsonObject(record)) {
        continue;
      }

      const conversationId = textIn(record, 'conversationId');

      if (conversationId == null || index.has(conversationId)) {
        continue;
      }

      index.set(conversationId, {
        display: textIn(record, 'display'),
        timestampMs: numberIn(record, 'timestamp'),
        workspace: textIn(record, 'workspace'),
      });
    }
  }
  catch {
    return index;
  }

  return index;
};

/**
 * One step record becomes at most one turn.
 *
 * Replayed context and system bookkeeping are not turns, and a step with no
 * content is thinking or a bare tool call with nothing to show.
 */
const entryOf = (
  record: JsonObject,
  conversationId: string,
  lineIndex: number,
  timestampMs: number,
): readonly AntigravityEntry[] => {
  const source = textIn(record, 'source') ?? '';
  const stepType = textIn(record, 'type') ?? '';

  if (stepType === 'CONVERSATION_HISTORY' || source === 'SYSTEM') {
    return [];
  }

  const content = textIn(record, 'content');

  if (content == null) {
    return [];
  }

  const stepIndex = numberIn(record, 'step_index') ?? lineIndex;
  const uuid = `${conversationId}-step-${String(stepIndex)}`;
  const timestamp = new Date(timestampMs).toISOString();

  if (source === 'USER_EXPLICIT' || stepType === 'USER_INPUT') {
    const split = splitUserText(content);

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

  if (source !== 'MODEL') {
    return [];
  }

  const blocks: AssistantBlock[] = [];

  // A model step that is not the planner speaking is the agent using something.
  if (stepType.length > 0 && stepType !== 'PLANNER_RESPONSE') {
    blocks.push({
      blockType: 'tool-use',
      call: {
        id: `${uuid}-tool`,
        name: stepType,
        input: {
          kind: 'generic',
          title: stepType,
          rows: [],
        },
      },
    });
  }

  blocks.push({
    blockType: 'text',
    text: content,
  });

  return [{
    kind: 'assistant',
    uuid,
    timestamp,
    sidechain: false,
    blocks,
  }];
};

export const parseAntigravityTranscript = (
  content: string,
  conversationId: string,
  fallbackMs: number,
): readonly AntigravityEntry[] => {
  const entries: AntigravityEntry[] = [];
  let lastMs = fallbackMs;

  for (const [lineIndex, line] of content.split('\n').entries()) {
    const record = parseJsonContainer(line);

    if (!isJsonObject(record)) {
      continue;
    }

    lastMs = isoOf(textIn(record, 'created_at')) ?? lastMs;
    entries.push(...entryOf(record, conversationId, lineIndex, lastMs));
  }

  return entries;
};

const sessionOf = async (
  root: string,
  conversationId: string,
  index: ReadonlyMap<string, ConversationIndexEntry>,
): Promise<AntigravitySession | undefined> => {
  const filePath = join(root, BRAIN_DIR, conversationId, TRANSCRIPT);

  try {
    const [content, facts] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)]);
    const placement = index.get(conversationId);
    const entries = parseAntigravityTranscript(
      content,
      conversationId,
      placement?.timestampMs ?? facts.mtimeMs,
    );

    if (entries.length === 0) {
      return undefined;
    }

    const stamps = entries.map((entry) => {
      return Date.parse(entry.timestamp);
    });

    return {
      conversationId,
      entries,
      filePath,
      firstTimestampMs: Math.min(...stamps),
      // Appended as the conversation runs, so mtime is activity the newest entry
      // can predate. Every file-per-session agent folds it in, or ordering diverges.
      lastTimestampMs: Math.max(...stamps, facts.mtimeMs),
      modifiedMs: facts.mtimeMs,
      preview: firstUserMessageText(entries),
      sizeBytes: facts.size,
      title: placement?.display,
      workspace: placement?.workspace,
    };
  }
  catch {
    return undefined;
  }
};

const scanSessions = async (roots: readonly string[]): Promise<readonly AntigravitySession[]> => {
  const found = await Promise.all(roots.map(async (root) => {
    const index = await readIndex(root);

    try {
      const dirs = await readdir(join(root, BRAIN_DIR), { withFileTypes: true });
      const sessions = await Promise.all(dirs.filter((dir) => {
        return dir.isDirectory();
      }).map(async (dir) => {
        return sessionOf(root, dir.name, index);
      }));

      return sessions;
    }
    catch {
      return [];
    }
  }));

  return found.flat().filter((session): session is AntigravitySession => {
    return session != null;
  });
};

const projectIdOf = (session: AntigravitySession): string => {
  return session.workspace ?? UNPLACED;
};

export const listAntigravitySessions = async (
  agent: AgentId,
  roots: readonly string[],
  projectId?: string,
): Promise<readonly SessionSummary[]> => {
  const [sessions, desktop] = await Promise.all([
    scanSessions(roots),
    listAntigravityDesktopSessions(agent, roots, projectId),
  ]);

  return [...desktop, ...sessions.filter((session) => {
    return projectId == null || projectIdOf(session) === projectId;
  }).map((session) => {
    return {
      agent,
      id: session.conversationId,
      actualSessionId: session.conversationId,
      filePath: session.filePath,
      projectId: projectIdOf(session),
      title: session.title,
      preview: session.preview == null
        ? undefined
        : humanPreview(session.preview, appConfig.previewLength),
      messageCount: conversationMessageCount(session.entries),
      firstTimestampMs: session.firstTimestampMs,
      lastTimestampMs: session.lastTimestampMs,
      modifiedMs: session.modifiedMs,
      sizeBytes: session.sizeBytes,
      cwd: session.workspace,
    } satisfies SessionSummary;
  })].sort((left, right) => {
    return right.lastTimestampMs - left.lastTimestampMs;
  });
};

export const listAntigravityProjects = async (
  agent: AgentId,
  roots: readonly string[],
): Promise<readonly ProjectSummary[]> => {
  const [sessions, desktop] = await Promise.all([
    scanSessions(roots),
    listAntigravityDesktopProjects(agent, roots),
  ]);
  const byProject = new Map<string, AntigravitySession[]>();

  for (const session of sessions) {
    const id = projectIdOf(session);
    const bucket = byProject.get(id) ?? [];

    bucket.push(session);
    byProject.set(id, bucket);
  }

  return [...desktop, ...[...byProject.entries()].map(([id, values]) => {
    const workspace = values.find((value) => {
      return value.workspace != null;
    })?.workspace;

    return {
      agent,
      id,
      name: workspace == null ? 'Unplaced conversations' : basename(workspace),
      actualPath: workspace,
      sessionCount: values.length,
      messageCount: values.reduce((total, value) => {
        return total + conversationMessageCount(value.entries);
      }, 0),
      lastActivityMs: values.reduce((latest, value) => {
        return Math.max(latest, value.lastTimestampMs);
      }, 0),
    } satisfies ProjectSummary;
  })].sort((left, right) => {
    return right.lastActivityMs - left.lastActivityMs;
  });
};

export const loadAntigravityEntries = async (
  filePath: string,
): Promise<readonly HistoryEntry[] | undefined> => {
  const desktop = await loadAntigravityDesktopEntries(filePath);

  if (desktop != null) {
    return desktop;
  }

  try {
    const [content, facts] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)]);
    const entries = parseAntigravityTranscript(content, basename(filePath), facts.mtimeMs);

    return entries.length === 0 ? undefined : entries;
  }
  catch {
    return undefined;
  }
};
