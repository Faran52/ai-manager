import { readFile, stat } from 'node:fs/promises';
import {
  basename,
  dirname,
  extname,
  relative,
} from 'node:path';

import { appConfig } from '@config/appConfig';

import { parseJsonContainer } from '@utils/jsonUtils';
import { humanPreview } from '@utils/titleUtils';

import { splitUserText } from '../../session/utils/parserUtils';

import { clineOutcomes } from './clineOutcomeUtils';
import { parseClineBlocks, TASK_PROGRESS } from './clineXmlUtils';
import { conversationMessageCount, firstUserMessageText } from './outcomeUtils';
import { listTree } from './treeUtils';

import type { AgentId } from '@config/agents';
import type { JsonObject, JsonValue } from '@utils/jsonUtils';
import type {
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
} from '../types';

type StructuredEntry = Exclude<HistoryEntry, { kind: 'summary' }>;

interface StructuredSessionSummary extends SessionSummary {
  readonly cwd: string;
}

interface StructuredSession {
  readonly summary: StructuredSessionSummary;
  readonly entries: readonly HistoryEntry[];
}

interface WalkOptions {
  readonly agent: AgentId;
  readonly maxDepth: number;
}

const supportedExtensions = new Set(['.json', '.jsonl', '.md', '.ndjson', '.txt']);

/*
 * A Cline task is a directory of three files: the Anthropic-format transcript,
 * the UI event stream, and a metadata blob. Only the first is a conversation,
 * so reading the folder generically turned one task into three sessions that
 * all shared the id `api_conversation_history`.
 */
const CLINE_TRANSCRIPT = 'api_conversation_history.json';

// The extension that wrote the task is the only grouping the store offers.
const CLINE_FORKS: Readonly<Record<string, string>> = {
  'kilocode.kilo-code': 'Kilo Code',
  'rooveterinaryinc.roo-cline': 'Roo Code',
  'saoudrizwan.claude-dev': 'Cline',
};

const isRecord = (value: JsonValue | undefined): value is JsonObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const stringAt = (record: JsonObject, keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
};

const nestedRecord = (record: JsonObject, key: string): JsonObject | undefined => {
  const value = record[key];

  return isRecord(value) ? value : undefined;
};

const textFrom = (value: JsonValue | undefined): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(textFrom).filter(Boolean).join('\n');
  }

  if (!isRecord(value)) {
    return '';
  }

  return stringAt(value, ['text', 'content', 'value', 'message'])
    ?? textFrom(value.parts);
};

const roleFrom = (record: JsonObject): string | undefined => {
  const message = nestedRecord(record, 'message');

  return stringAt(record, ['role', 'sender', 'author'])
    ?? stringAt(message ?? {}, ['role', 'sender', 'author'])
    ?? stringAt(record, ['type']);
};

const normalizedRole = (role: string | undefined): 'assistant' | 'system' | 'user' | undefined => {
  const value = role?.toLowerCase();

  if (value == null) {
    return undefined;
  }

  if (value.includes('assistant') || value === 'ai' || value === 'model' || value === 'bot') {
    return 'assistant';
  }

  if (value.includes('user') || value === 'human' || value === 'prompt') {
    return 'user';
  }

  return value.includes('system') ? 'system' : undefined;
};

const timestampFrom = (record: JsonObject, fallbackMs: number): string => {
  const raw = record.timestamp ?? record.created_at ?? record.createdAt ?? record.date ?? record.time;
  const numeric = typeof raw === 'number' ? raw : Number.NaN;
  let milliseconds = fallbackMs;

  if (Number.isFinite(numeric)) {
    milliseconds = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }

  if (typeof raw === 'string' && !Number.isNaN(Date.parse(raw))) {
    return new Date(raw).toISOString();
  }

  return new Date(milliseconds).toISOString();
};

const recordsFrom = (value: JsonValue | undefined): readonly JsonObject[] => {
  if (Array.isArray(value)) {
    return value.flatMap(recordsFrom);
  }

  if (!isRecord(value)) {
    return [];
  }

  const directRole = normalizedRole(roleFrom(value));

  if (directRole != null) {
    return [value];
  }

  const knownRecords = recordsFromKnownKeys(value);

  return knownRecords.length > 0 ? knownRecords : recordsFromUnknownValues(value);
};

const recordsFromKnownKeys = (record: JsonObject): readonly JsonObject[] => {
  for (const key of ['messages', 'history', 'conversation', 'events', 'items', 'turns', 'entries']) {
    const nested = record[key];

    if (nested != null) {
      const records = recordsFrom(nested);

      if (records.length > 0) {
        return records;
      }
    }
  }

  return [];
};

const recordsFromEmbeddedJson = (value: string): readonly JsonObject[] => {
  if (!value.startsWith('{') && !value.startsWith('[')) {
    return [];
  }

  return recordsFrom(parseJsonContainer(value));
};

const recordsFromUnknownValue = (value: JsonValue | undefined): readonly JsonObject[] => {
  if (typeof value === 'string') {
    return recordsFromEmbeddedJson(value);
  }

  return typeof value === 'object' && value !== null ? recordsFrom(value) : [];
};

const recordsFromUnknownValues = (record: JsonObject): readonly JsonObject[] => {
  for (const nested of Object.values(record)) {
    const records = recordsFromUnknownValue(nested);

    if (records.length > 0) {
      return records;
    }
  }

  return [];
};

const entryFrom = (
  agent: AgentId | undefined,
  record: JsonObject,
  index: number,
  fallbackMs: number,
): StructuredEntry | undefined => {
  const role = normalizedRole(roleFrom(record));
  const message = nestedRecord(record, 'message') ?? nestedRecord(record, 'data');
  const text = textFrom(record.content ?? record.text ?? record.parts ?? message?.content ?? message?.text);

  if (role == null || text.length === 0) {
    return undefined;
  }

  const timestamp = timestampFrom(record, fallbackMs);
  const uuid = stringAt(record, ['uuid', 'id', 'messageId']) ?? `entry-${String(index)}`;

  if (role === 'assistant') {
    return {
      kind: 'assistant',
      uuid,
      timestamp,
      sidechain: false,
      model: stringAt(record, ['model', 'modelId']),
      blocks: agent === 'cline'
        ? parseClineBlocks(text, uuid)
        : [{
            blockType: 'text',
            text,
          }],
    };
  }

  if (role === 'system') {
    return {
      kind: 'system',
      uuid,
      timestamp,
      sidechain: false,
      text,
    };
  }

  const splitText = splitUserText(text);

  return {
    kind: 'user',
    uuid,
    timestamp,
    sidechain: false,
    meta: splitText.meta,
    text: splitText.text,
    ...(splitText.injectedText == null ? {} : { injectedText: splitText.injectedText }),
    outcomes: [],
  };
};

const markdownEntries = (
  agent: AgentId | undefined,
  content: string,
  fallbackMs: number,
): readonly StructuredEntry[] => {
  const sections = content.split(/^#{1,4}\s+(user|human|assistant|ai|system)\s*$/gimu);

  if (sections.length < 3) {
    return content.trim().length === 0
      ? []
      : [{
          kind: 'user',
          uuid: 'entry-0',
          timestamp: new Date(fallbackMs).toISOString(),
          sidechain: false,
          meta: false,
          text: content.trim(),
          outcomes: [],
        }];
  }

  const records: JsonObject[] = [];

  for (let index = 1; index < sections.length; index += 2) {
    records.push({
      role: String(sections[index]),
      content: String(sections[index + 1]).trim(),
    });
  }

  return records.flatMap((record, index) => {
    const entry = entryFrom(agent, record, index, fallbackMs);

    return entry == null ? [] : [entry];
  });
};

/**
 * Cline returns a tool result as the next user message rather than as a block
 * carrying the call's id, so the results in a message pair with the calls of
 * the assistant turn above it. A checklist gets no result, so it is not a call
 * a result can land on.
 */
const withClineOutcomes = (entries: readonly StructuredEntry[]): readonly StructuredEntry[] => {
  let callIds: readonly string[] = [];

  return entries.map((entry) => {
    if (entry.kind === 'assistant') {
      callIds = entry.blocks.flatMap((block) => {
        return block.blockType === 'tool-use' && block.call.name !== TASK_PROGRESS
          ? [block.call.id]
          : [];
      });

      return entry;
    }

    if (entry.kind !== 'user') {
      return entry;
    }

    const results = clineOutcomes(entry.text, callIds);

    return {
      ...entry,
      ...results,
      meta: results.text.length === 0,
    };
  });
};

export const parseStructuredHistory = (
  content: string,
  extension: string,
  fallbackMs: number,
  agent?: AgentId,
): readonly StructuredEntry[] => {
  if (extension === '.md' || extension === '.txt') {
    return markdownEntries(agent, content, fallbackMs);
  }

  const values: JsonValue[] = [];

  if (extension === '.jsonl' || extension === '.ndjson') {
    for (const line of content.split('\n')) {
      values.push(parseJsonContainer(line));
    }
  }
  else {
    values.push(parseJsonContainer(content));
  }

  const entries = values.flatMap(recordsFrom).flatMap((record, index) => {
    const entry = entryFrom(agent, record, index, fallbackMs);

    return entry == null ? [] : [entry];
  });

  return agent === 'cline' ? withClineOutcomes(entries) : entries;
};

const isAgentFile = (agent: AgentId, filePath: string): boolean => {
  const name = basename(filePath).toLowerCase();

  if (agent === 'aider') {
    return name.startsWith('.aider') && (name.endsWith('.md') || name.endsWith('.jsonl'));
  }

  if (agent === 'cline') {
    return name === CLINE_TRANSCRIPT;
  }

  return supportedExtensions.has(extname(name));
};

const walk = async (root: string, options: WalkOptions): Promise<readonly string[]> => {
  return (await listTree(root, options.maxDepth)).filter((filePath) => {
    return isAgentFile(options.agent, filePath);
  });
};

const projectIdFor = (root: string, filePath: string): string => {
  const folder = relative(root, dirname(filePath)).replaceAll('\\', '/');

  return folder.length === 0 ? basename(root) : folder;
};

/**
 * For Cline the task folder is the session and the extension folder above
 * `tasks/` is the project, which keeps Cline, Roo and Kilo apart instead of
 * turning every task id into its own single-session project.
 */
const identityFor = (agent: AgentId, root: string, filePath: string): {
  readonly cwd: string;
  readonly id: string;
  readonly projectId: string;
} => {
  if (agent === 'cline') {
    return {
      cwd: dirname(root),
      id: basename(dirname(filePath)),
      projectId: basename(dirname(root)),
    };
  }

  return {
    cwd: dirname(filePath),
    id: basename(filePath, extname(filePath)),
    projectId: projectIdFor(root, filePath),
  };
};

const structuredSession = async (
  agent: AgentId,
  root: string,
  filePath: string,
): Promise<StructuredSession | undefined> => {
  try {
    const info = await stat(filePath);
    const content = await readFile(filePath, 'utf8');
    const entries = parseStructuredHistory(
      content,
      extname(filePath).toLowerCase(),
      info.mtimeMs,
      agent,
    );

    if (entries.length === 0) {
      return undefined;
    }

    const stamps = entries.map((entry) => {
      return Date.parse(entry.timestamp);
    }).filter(Number.isFinite);
    const {
      cwd,
      id,
      projectId,
    } = identityFor(agent, root, filePath);
    const preview = firstUserMessageText(entries);

    return {
      entries,
      summary: {
        agent,
        actualSessionId: id,
        id,
        filePath,
        projectId,
        preview: preview == null ? undefined : humanPreview(preview, appConfig.previewLength),
        messageCount: conversationMessageCount(entries),
        firstTimestampMs: Math.min(...stamps),
        lastTimestampMs: Math.max(...stamps),
        modifiedMs: info.mtimeMs,
        sizeBytes: info.size,
        cwd,
      },
    };
  }
  catch {
    return undefined;
  }
};

export const scanStructuredSessions = async (
  agent: AgentId,
  roots: readonly string[],
): Promise<readonly StructuredSession[]> => {
  const sessions: StructuredSession[] = [];

  for (const root of roots) {
    for (const filePath of await walk(root, {
      agent,
      maxDepth: 6,
    })) {
      const session = await structuredSession(agent, root, filePath);

      if (session != null) {
        sessions.push(session);
      }
    }
  }

  return sessions;
};

export const listStructuredProjects = async (
  agent: AgentId,
  roots: readonly string[],
): Promise<readonly ProjectSummary[]> => {
  const sessions = await scanStructuredSessions(agent, roots);
  const grouped = new Map<string, StructuredSession[]>();

  for (const session of sessions) {
    const values = grouped.get(session.summary.projectId) ?? [];

    values.push(session);
    grouped.set(session.summary.projectId, values);
  }

  return [...grouped.entries()].map(([id, values]) => {
    const actualPath = values.reduce((_path, value) => {
      return value.summary.cwd;
    }, id);

    return {
      agent,
      id,
      name: CLINE_FORKS[basename(actualPath)] ?? basename(actualPath),
      actualPath,
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

export const listStructuredSessions = async (
  agent: AgentId,
  roots: readonly string[],
  projectId?: string,
): Promise<readonly SessionSummary[]> => {
  const sessions = await scanStructuredSessions(agent, roots);

  return sessions.filter((session) => {
    return projectId == null || session.summary.projectId === projectId;
  }).map((session) => {
    return session.summary;
  }).sort((left, right) => {
    return right.lastTimestampMs - left.lastTimestampMs;
  });
};

export const loadStructuredEntries = async (filePath: string): Promise<readonly HistoryEntry[] | undefined> => {
  try {
    const info = await stat(filePath);
    const content = await readFile(filePath, 'utf8');

    return parseStructuredHistory(
      content,
      extname(filePath).toLowerCase(),
      info.mtimeMs,
      basename(filePath) === CLINE_TRANSCRIPT ? 'cline' : undefined,
    );
  }
  catch {
    return undefined;
  }
};
