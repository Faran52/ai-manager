/*
 * Antigravity CLI, reverse engineered rather than documented, so every step is
 * best effort: a malformed line is skipped rather than failing the session.
 * Covers the CLI only; the desktop store is antigravityDesktopUtils.
 */
import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';
import { basename, join } from 'node:path';

import { appConfig } from '@config/appConfig';

import {
  isJsonObject,
  numberAt,
  parseJsonContainer,
  trimmedTextAt,
} from '@utils/jsonUtils';
import { humanPreview } from '@utils/titleUtils';

import { splitUserText } from '../../session/utils/parserUtils';

import {
  listAntigravityDesktopProjects,
  listAntigravityDesktopSessions,
  loadAntigravityDesktopEntries,
} from './antigravityDesktopUtils';
import { conversationMessageCount, firstUserMessageText } from './outcomeUtils';
import { namedByFolder, projectsFromSessions } from './projectSummaryUtils';

import type { AgentId } from '@config/agents';
import type { JsonObject } from '@utils/jsonUtils';
import type {
  AssistantBlock,
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
  SummaryTurnEntry,
} from '../types';

type AntigravityEntry = Exclude<HistoryEntry, SummaryTurnEntry>;

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

      const conversationId = trimmedTextAt(record, 'conversationId');

      if (conversationId == null || index.has(conversationId)) {
        continue;
      }

      index.set(conversationId, {
        display: trimmedTextAt(record, 'display'),
        timestampMs: numberAt(record, 'timestamp'),
        workspace: trimmedTextAt(record, 'workspace'),
      });
    }
  }
  catch {
    return index;
  }

  return index;
};

// Replayed context and system bookkeeping are not turns, and a step with no
// content is thinking or a bare tool call with nothing to show.
const entryOf = (
  record: JsonObject,
  conversationId: string,
  lineIndex: number,
  timestampMs: number,
): readonly AntigravityEntry[] => {
  const source = trimmedTextAt(record, 'source') ?? '';
  const stepType = trimmedTextAt(record, 'type') ?? '';

  if (stepType === 'CONVERSATION_HISTORY' || source === 'SYSTEM') {
    return [];
  }

  const content = trimmedTextAt(record, 'content');

  if (content == null) {
    return [];
  }

  const stepIndex = numberAt(record, 'step_index') ?? lineIndex;
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

    lastMs = isoOf(trimmedTextAt(record, 'created_at')) ?? lastMs;
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

const summaryOf = (agent: AgentId, session: AntigravitySession): SessionSummary => {
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
  };
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
  const inProject = sessions.filter((session) => {
    return projectId == null || projectIdOf(session) === projectId;
  });
  const summaries = inProject.map((session) => {
    return summaryOf(agent, session);
  });

  return [...desktop, ...summaries].sort((left, right) => {
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
  const summaries = sessions.map((session) => {
    return summaryOf(agent, session);
  });
  const cli = projectsFromSessions(agent, summaries, namedByFolder('Unplaced conversations'));

  return [...desktop, ...cli].sort((left, right) => {
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
