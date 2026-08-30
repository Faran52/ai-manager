import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { appConfig } from '@config/appConfig';

import { diffLines, parseUnifiedDiff } from '@utils/diffUtils';
import { humanPreview } from '@utils/titleUtils';

import { parseToolInput, splitUserText } from '../../session/utils/parserUtils';

import { fileFactsStore } from './fileFactsUtils';
import { conversationMessageCount } from './outcomeUtils';

import type {
  AssistantBlock,
  AssistantTurnEntry,
  ChangedFile,
  HistoryEntry,
  PatchHunk,
  ProjectSummary,
  SessionSummary,
  ToolCall,
  ToolOutcome,
} from '../types';
import type { RawToolInput } from './claudeRawUtils';
import type { FileFacts } from './fileFactsUtils';

interface CodexContentPart {
  readonly text?: string | undefined;
  readonly type?: string | undefined;
}

interface CodexMcpInvocation {
  readonly server?: string | undefined;
  readonly tool?: string | undefined;
  readonly arguments?: RawToolInput | undefined;
}

interface CodexMcpResult {
  readonly Ok?: {
    readonly content?: readonly CodexContentPart[] | undefined;
  }
  | undefined;
  readonly Err?: string | undefined;
}

interface CodexFileChange {
  readonly type?: string | undefined;
  readonly content?: string | undefined;
  readonly unified_diff?: string | undefined;
}

interface CodexRepository {
  readonly branch?: string | undefined;
}

interface CodexPayload {
  readonly arguments?: string | undefined;
  readonly call_id?: string | undefined;
  readonly content?: readonly CodexContentPart[] | undefined;
  readonly cwd?: string | undefined;
  readonly changes?: Readonly<Record<string, CodexFileChange>> | undefined;
  readonly git?: CodexRepository | undefined;
  readonly id?: string | undefined;
  readonly info?: CodexTokenInfo | undefined;
  readonly input?: string | undefined;
  readonly invocation?: CodexMcpInvocation | undefined;
  readonly model?: string | undefined;
  readonly result?: CodexMcpResult | undefined;
  readonly name?: string | undefined;
  readonly output?: string | readonly CodexContentPart[] | undefined;
  readonly role?: string | undefined;
  readonly summary?: readonly CodexContentPart[] | undefined;
  readonly type?: string | undefined;
}

interface CodexRawTokenUsage {
  readonly cached_input_tokens?: number | undefined;
  readonly cache_write_input_tokens?: number | undefined;
  readonly input_tokens?: number | undefined;
  readonly output_tokens?: number | undefined;
}

interface CodexTokenInfo {
  readonly last_token_usage?: CodexRawTokenUsage | undefined;
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
  readonly gitBranch: string | undefined;
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
  gitBranch: string | undefined;
  // Codex reports what a patch did as its own event, between the tool call and
  // the call's output, so these wait here for the outcome they belong to.
  pendingPatch: readonly PatchHunk[] | undefined;
  pendingChanged: readonly ChangedFile[] | undefined;
  counter: number;
}

// What a listing needs to know about a rollout file. The turns themselves are
// deliberately absent: they are the large part, and only the viewer reads them.
interface CodexSessionFacts {
  readonly actualSessionId: string;
  readonly cwd: string;
  readonly title: string | undefined;
  readonly gitBranch: string | undefined;
  readonly turnCount: number;
  readonly messageCount: number;
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
}

interface CodexFileSession extends CodexSessionFacts, FileFacts {
  readonly filePath: string;
}

// Rollouts are one file per session, so this covers a long history of them.
const CACHED_SESSIONS = 2_048;

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

const outputContent = (payload: CodexPayload): string => {
  if (typeof payload.output === 'string') {
    return payload.output;
  }

  return (payload.output ?? []).flatMap((part) => {
    return part.text == null ? [] : [part.text];
  }).join('\n\n');
};

const commandFrom = (payload: CodexPayload): ToolCall => {
  const rawArguments = payload.arguments ?? payload.input;
  const args = rawArguments == null ? undefined : parsedJson(rawArguments);
  const commandArgs = isCommandArguments(args) ? args : undefined;
  const command = commandArgs?.cmd ?? commandArgs?.command;
  const name = payload.name === 'exec_command' || payload.name === 'exec' ? 'Bash' : (payload.name ?? 'tool');

  return {
    id: payload.call_id ?? payload.id ?? '',
    name,
    input: parseToolInput(name, command == null ? {} : { command }),
  };
};

const outcomeFrom = (
  payload: CodexPayload,
  patch: readonly PatchHunk[] | undefined,
  changed: readonly ChangedFile[] | undefined,
): ToolOutcome => {
  const output = outputContent(payload);
  const parsed = output.length === 0 ? undefined : parsedJson(output);
  const text = isCommandOutput(parsed) ? parsed.output : (output || undefined);

  return {
    toolUseId: payload.call_id ?? '',
    status: 'ok',
    text,
    images: [],
    ...patch == null ? {} : { patch },
    ...changed == null ? {} : { changed },
  };
};

// A written file has no earlier version to compare against and a removed one
// has no later version, so each is shown whole against nothing.
const hunksOfChange = (change: CodexFileChange): readonly PatchHunk[] => {
  if (change.unified_diff != null) {
    return parseUnifiedDiff(change.unified_diff);
  }

  const content = change.content ?? '';

  if (content.length === 0) {
    return [];
  }

  return change.type === 'delete' ? diffLines(content, '') : diffLines('', content);
};

const absorbPatchApply = (scan: CodexScan, payload: CodexPayload): void => {
  const changes = Object.entries(payload.changes ?? {});
  const hunks = changes.flatMap(([, change]) => {
    return hunksOfChange(change);
  });
  const changed = changes.map(([path, change]) => {
    return {
      path,
      added: change.type === 'add',
    };
  });

  scan.pendingPatch = hunks.length > 0 ? hunks : undefined;
  scan.pendingChanged = changed.length > 0 ? changed : undefined;
};

/**
 * Codex reports an MCP call only once it has finished, as a single event
 * carrying the invocation and its result together, so the call and its outcome
 * are built from the same payload rather than paired up later.
 */
const absorbMcpCall = (scan: CodexScan, payload: CodexPayload, timestamp: string): void => {
  const invocation = payload.invocation;

  if (invocation == null) {
    return;
  }

  scan.counter += 1;

  const uuid = `${scan.actualSessionId}-mcp-${String(scan.counter)}`;
  const tool = invocation.tool ?? 'tool';
  const callId = payload.call_id ?? uuid;
  const result = payload.result;
  const text = (result?.Ok?.content ?? []).flatMap((part) => {
    return part.text == null ? [] : [part.text];
  }).join('\n\n');

  scan.entries.push({
    kind: 'assistant',
    uuid,
    timestamp,
    sidechain: false,
    model: scan.model,
    blocks: [{
      blockType: 'tool-use',
      call: {
        id: callId,
        name: tool,
        serverName: invocation.server ?? 'mcp',
        input: parseToolInput(tool, invocation.arguments ?? {}),
      },
    }],
  });

  scan.entries.push({
    kind: 'user',
    uuid: `${uuid}-out`,
    timestamp,
    sidechain: false,
    meta: true,
    text: '',
    outcomes: [{
      toolUseId: callId,
      status: result?.Err == null ? 'ok' : 'error',
      text: result?.Err ?? (text.length > 0 ? text : undefined),
      images: [],
    }],
  });
};

const usageFrom = (payload: CodexPayload): AssistantTurnEntry['usage'] => {
  const usage = payload.info?.last_token_usage;

  if (usage == null) {
    return undefined;
  }

  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheCreationTokens: usage.cache_write_input_tokens ?? 0,
    cacheReadTokens: usage.cached_input_tokens ?? 0,
  };
};

const absorbUsage = (scan: CodexScan, payload: CodexPayload): void => {
  const usage = usageFrom(payload);
  const index = scan.entries.findLastIndex((entry) => {
    return entry.kind === 'assistant';
  });
  const entry = scan.entries[index];

  if (usage != null && entry?.kind === 'assistant') {
    scan.entries[index] = {
      ...entry,
      usage,
    };
  }
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
    const splitText = splitUserText(text);

    if (!splitText.meta) {
      scan.title ??= humanPreview(splitText.text, appConfig.previewLength);
    }

    scan.entries.push({
      kind: 'user',
      uuid,
      timestamp,
      sidechain: false,
      meta: splitText.meta,
      text: splitText.text,
      ...(splitText.injectedText == null ? {} : { injectedText: splitText.injectedText }),
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

  if (payload.type === 'compaction') {
    scan.entries.push({
      kind: 'summary',
      text: 'Conversation compacted',
    });

    return;
  }

  if (payload.type === 'function_call' || payload.type === 'custom_tool_call') {
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
  else if (payload.type === 'function_call_output' || payload.type === 'custom_tool_call_output') {
    scan.entries.push({
      kind: 'user',
      uuid,
      timestamp,
      sidechain: false,
      meta: true,
      text: '',
      outcomes: [outcomeFrom(payload, scan.pendingPatch, scan.pendingChanged)],
    });
    scan.pendingPatch = undefined;
    scan.pendingChanged = undefined;
  }
  else if (payload.type === 'reasoning') {
    const thinking = (payload.summary ?? []).flatMap((part) => {
      return part.text == null ? [] : [part.text];
    }).join('\n\n');

    if (thinking.length > 0) {
      scan.entries.push({
        kind: 'assistant',
        uuid,
        timestamp,
        sidechain: false,
        model: scan.model,
        blocks: [{
          blockType: 'thinking',
          thinking,
        }],
      });
    }
  }
};

// Codex writes an empty branch outside a repository, which is not a branch.
const nonEmptyBranch = (branch: string | undefined): string | undefined => {
  return branch != null && branch.length > 0 ? branch : undefined;
};

const absorbCodexLine = (scan: CodexScan, line: CodexLine): void => {
  const payload = line.payload;
  const timestamp = line.timestamp ?? '';

  absorbTimestamp(scan, timestamp);

  if (line.type === 'session_meta' && scan.actualSessionId.length === 0) {
    scan.actualSessionId = payload?.id ?? '';
    scan.cwd = payload?.cwd ?? '';
    scan.gitBranch = nonEmptyBranch(payload?.git?.branch);
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
  else if (line.type === 'event_msg' && payload?.type === 'token_count') {
    absorbUsage(scan, payload);
  }
  else if (line.type === 'event_msg' && payload?.type === 'mcp_tool_call_end') {
    absorbMcpCall(scan, payload, timestamp);
  }
  else if (line.type === 'event_msg' && payload?.type === 'patch_apply_end') {
    absorbPatchApply(scan, payload);
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
    gitBranch: undefined,
    pendingPatch: undefined,
    pendingChanged: undefined,
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
    gitBranch: scan.gitBranch,
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

const codexFacts = fileFactsStore<CodexSessionFacts>(CACHED_SESSIONS);

const fileSession = async (filePath: string): Promise<CodexFileSession | undefined> => {
  const facts = await codexFacts(filePath, (content) => {
    const parsed = parseCodexHistory(content);

    return {
      actualSessionId: parsed.actualSessionId,
      cwd: parsed.cwd,
      title: parsed.title,
      gitBranch: parsed.gitBranch,
      turnCount: parsed.entries.length,
      messageCount: conversationMessageCount(parsed.entries),
      firstTimestampMs: parsed.firstTimestampMs,
      lastTimestampMs: parsed.lastTimestampMs,
    };
  });

  /* v8 ignore next 3 -- the file can disappear between the directory scan and the read */
  if (facts == null) {
    return undefined;
  }

  return {
    ...facts,
    filePath,
  };
};

export const listCodexSessions = async (codexDir: string, projectId: string): Promise<readonly SessionSummary[]> => {
  const sessions = await Promise.all((await rolloutFiles(codexDir)).map(fileSession));

  return sessions.flatMap((session) => {
    if (session?.cwd !== projectId || session.turnCount === 0) {
      return [];
    }

    const summary: SessionSummary = {
      agent: 'codex',
      actualSessionId: session.actualSessionId,
      id: session.filePath,
      filePath: session.filePath,
      projectId,
      title: session.title,
      messageCount: session.messageCount,
      firstTimestampMs: session.firstTimestampMs,
      lastTimestampMs: Math.max(session.lastTimestampMs, session.modifiedMs),
      modifiedMs: session.modifiedMs,
      sizeBytes: session.sizeBytes,
      cwd: session.cwd,
      gitBranch: session.gitBranch,
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

    if (session.turnCount > 0) {
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
        return total + session.messageCount;
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
