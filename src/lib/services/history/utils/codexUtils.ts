import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';
import { basename, join } from 'node:path';

import { appConfig } from '@config/appConfig';

import { humanPreview } from '@utils/titleUtils';

import { isMetaText, parseToolInput } from '../../session/utils/parserUtils';

import type {
  AssistantBlock,
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
  ToolCall,
  ToolOutcome,
} from '../types';

interface CodexContentPart {
  readonly text?: string | undefined;
  readonly type?: string | undefined;
}

interface CodexPayload {
  readonly arguments?: string | undefined;
  readonly call_id?: string | undefined;
  readonly content?: readonly CodexContentPart[] | undefined;
  readonly cwd?: string | undefined;
  readonly id?: string | undefined;
  readonly model?: string | undefined;
  readonly name?: string | undefined;
  readonly output?: string | undefined;
  readonly role?: string | undefined;
  readonly type?: string | undefined;
}

interface CodexLine {
  readonly payload?: CodexPayload | undefined;
  readonly timestamp?: string | undefined;
  readonly type?: string | undefined;
}

interface CodexCommandArguments {
  readonly cmd?: string | undefined;
  readonly command?: string | undefined;
}

interface CodexCommandOutput {
  readonly output?: string | undefined;
}

interface ParsedCodexSession {
  readonly actualSessionId: string;
  readonly cwd: string;
  readonly entries: readonly HistoryEntry[];
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
  readonly title: string | undefined;
}

interface CodexScan {
  actualSessionId: string;
  cwd: string;
  fallbackCwd: string;
  entries: HistoryEntry[];
  firstTimestampMs: number;
  lastTimestampMs: number;
  model: string | undefined;
  title: string | undefined;
  counter: number;
}

interface CodexFileSession extends ParsedCodexSession {
  readonly filePath: string;
  readonly modifiedMs: number;
  readonly sizeBytes: number;
}

const isCodexLine = (value: unknown): value is CodexLine => {
  return typeof value === 'object' && value !== null;
};

const isCommandArguments = (value: unknown): value is CodexCommandArguments => {
  return typeof value === 'object' && value !== null;
};

const isCommandOutput = (value: unknown): value is CodexCommandOutput => {
  return typeof value === 'object' && value !== null;
};

const parsedJson = (text: string): object | undefined => {
  try {
    const parsed: unknown = JSON.parse(text);

    return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
  }
  catch {
    return undefined;
  }
};

const textContent = (payload: CodexPayload): string => {
  return (payload.content ?? []).flatMap((part) => {
    return part.text == null ? [] : [part.text];
  }).join('\n\n');
};

const commandFrom = (payload: CodexPayload): ToolCall => {
  const args = payload.arguments == null ? undefined : parsedJson(payload.arguments);
  const commandArgs = isCommandArguments(args) ? args : undefined;
  const command = commandArgs?.cmd ?? commandArgs?.command;
  const name = payload.name === 'exec_command' ? 'Bash' : (payload.name ?? 'tool');

  return {
    id: payload.call_id ?? payload.id ?? '',
    name,
    input: parseToolInput(name, command == null ? {} : { command }),
  };
};

const outcomeFrom = (payload: CodexPayload): ToolOutcome => {
  const parsed = payload.output == null ? undefined : parsedJson(payload.output);
  const text = isCommandOutput(parsed) ? parsed.output : payload.output;

  return {
    toolUseId: payload.call_id ?? '',
    status: 'ok',
    text,
    images: [],
  };
};

const absorbTimestamp = (scan: CodexScan, timestamp: string): void => {
  const timestampMs = Date.parse(timestamp);

  if (!Number.isNaN(timestampMs)) {
    scan.firstTimestampMs = Math.min(scan.firstTimestampMs, timestampMs);
    scan.lastTimestampMs = Math.max(scan.lastTimestampMs, timestampMs);
  }
};

const absorbMessage = (scan: CodexScan, payload: CodexPayload, timestamp: string, uuid: string): void => {
  const text = textContent(payload);

  if (payload.role === 'user') {
    const meta = isMetaText(text);

    if (!meta) {
      scan.title ??= humanPreview(text, appConfig.previewLength);
    }

    scan.entries.push({
      kind: 'user',
      uuid,
      timestamp,
      sidechain: false,
      meta,
      text,
      outcomes: [],
    });
  }
  else if (payload.role === 'assistant') {
    scan.entries.push({
      kind: 'assistant',
      uuid,
      timestamp,
      sidechain: false,
      model: scan.model,
      blocks: text.length > 0
        ? [{
            blockType: 'text',
            text,
          }]
        : [],
    });
  }
};

const absorbResponseItem = (scan: CodexScan, payload: CodexPayload, timestamp: string): void => {
  scan.counter += 1;
  const uuid = payload.id ?? `${scan.actualSessionId}-${String(scan.counter)}`;

  if (payload.type === 'message') {
    absorbMessage(scan, payload, timestamp, uuid);

    return;
  }

  if (payload.type === 'function_call') {
    const block: AssistantBlock = {
      blockType: 'tool-use',
      call: commandFrom(payload),
    };

    scan.entries.push({
      kind: 'assistant',
      uuid,
      timestamp,
      sidechain: false,
      model: scan.model,
      blocks: [block],
    });
  }
  else if (payload.type === 'function_call_output') {
    scan.entries.push({
      kind: 'user',
      uuid,
      timestamp,
      sidechain: false,
      meta: true,
      text: '',
      outcomes: [outcomeFrom(payload)],
    });
  }
};

const absorbCodexLine = (scan: CodexScan, line: CodexLine): void => {
  const payload = line.payload;
  const timestamp = line.timestamp ?? '';

  absorbTimestamp(scan, timestamp);

  if (line.type === 'session_meta' && scan.actualSessionId.length === 0) {
    scan.actualSessionId = payload?.id ?? '';
    scan.cwd = payload?.cwd ?? '';
  }
  else if (line.type === 'turn_context') {
    scan.model = payload?.model ?? scan.model;
    scan.fallbackCwd = payload?.cwd ?? scan.fallbackCwd;
  }
  else if (line.type === 'compacted') {
    scan.entries.push({
      kind: 'summary',
      text: 'Conversation compacted',
    });
  }
  else if (line.type === 'response_item' && payload != null) {
    absorbResponseItem(scan, payload, timestamp);
  }
};

export const parseCodexHistory = (content: string): ParsedCodexSession => {
  const scan: CodexScan = {
    actualSessionId: '',
    cwd: '',
    fallbackCwd: '',
    entries: [],
    firstTimestampMs: Number.POSITIVE_INFINITY,
    lastTimestampMs: 0,
    model: undefined,
    title: undefined,
    counter: 0,
  };

  for (const rawLine of content.split('\n')) {
    const parsed = parsedJson(rawLine);

    if (isCodexLine(parsed)) {
      absorbCodexLine(scan, parsed);
    }
  }

  return {
    actualSessionId: scan.actualSessionId,
    cwd: scan.cwd || scan.fallbackCwd || 'unknown',
    entries: scan.entries,
    firstTimestampMs: Number.isFinite(scan.firstTimestampMs) ? scan.firstTimestampMs : 0,
    lastTimestampMs: scan.lastTimestampMs,
    title: scan.title,
  };
};

const rolloutFiles = async (codexDir: string): Promise<readonly string[]> => {
  const files: string[] = [];

  for (const folder of ['sessions', 'archived_sessions']) {
    const root = join(codexDir, folder);

    try {
      const dirents = await readdir(root, {
        recursive: true,
        withFileTypes: true,
      });

      for (const dirent of dirents) {
        if (dirent.isFile() && dirent.name.startsWith('rollout-') && dirent.name.endsWith('.jsonl')) {
          files.push(join(dirent.parentPath, dirent.name));
        }
      }
    }
    catch {
    }
  }

  return files;
};

const fileSession = async (filePath: string): Promise<CodexFileSession | undefined> => {
  try {
    const [content, facts] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)]);

    return {
      ...parseCodexHistory(content),
      filePath,
      modifiedMs: facts.mtimeMs,
      sizeBytes: facts.size,
    };
  }
  /* v8 ignore next -- the file can disappear between directory scan and read */
  catch {
    return undefined;
  }
};

export const listCodexSessions = async (codexDir: string, projectId: string): Promise<readonly SessionSummary[]> => {
  const sessions = await Promise.all((await rolloutFiles(codexDir)).map(fileSession));

  return sessions.flatMap((session) => {
    if (session?.cwd !== projectId || session.entries.length === 0) {
      return [];
    }

    const summary: SessionSummary = {
      agent: 'codex',
      actualSessionId: session.actualSessionId,
      id: session.filePath,
      filePath: session.filePath,
      projectId,
      title: session.title,
      messageCount: session.entries.filter((entry) => {
        return entry.kind === 'user' || entry.kind === 'assistant';
      }).length,
      firstTimestampMs: session.firstTimestampMs,
      lastTimestampMs: Math.max(session.lastTimestampMs, session.modifiedMs),
      modifiedMs: session.modifiedMs,
      sizeBytes: session.sizeBytes,
      cwd: session.cwd,
    };

    return [summary];
  }).sort((left, right) => {
    return right.lastTimestampMs - left.lastTimestampMs;
  });
};

export const listCodexProjects = async (codexDir: string): Promise<readonly ProjectSummary[]> => {
  const sessions = await Promise.all((await rolloutFiles(codexDir)).map(fileSession));
  const byCwd = new Map<string, CodexFileSession[]>();

  for (const session of sessions) {
    /* v8 ignore next -- only possible when a scanned file disappears before read */
    if (session == null) {
      continue;
    }

    if (session.entries.length > 0) {
      byCwd.set(session.cwd, [...(byCwd.get(session.cwd) ?? []), session]);
    }
  }

  return [...byCwd].map(([cwd, projectSessions]) => {
    const project: ProjectSummary = {
      agent: 'codex',
      id: cwd,
      name: cwd === 'unknown' ? 'Unknown project' : basename(cwd),
      actualPath: cwd === 'unknown' ? undefined : cwd,
      sessionCount: projectSessions.length,
      messageCount: projectSessions.reduce((total, session) => {
        return total + session.entries.length;
      }, 0),
      lastActivityMs: projectSessions.reduce((latest, session) => {
        return Math.max(latest, session.lastTimestampMs, session.modifiedMs);
      }, 0),
    };

    return project;
  }).sort((left, right) => {
    return right.lastActivityMs - left.lastActivityMs;
  });
};

export const loadCodexEntries = async (filePath: string): Promise<readonly HistoryEntry[] | undefined> => {
  try {
    return parseCodexHistory(await readFile(filePath, 'utf8')).entries;
  }
  catch {
    return undefined;
  }
};
