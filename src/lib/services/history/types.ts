import type { AgentId } from '@config/agents';

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationTokens: number;
  readonly cacheReadTokens: number;
}

export interface TodoItem {
  readonly content: string;
  readonly status: string;
  readonly activeForm?: string | undefined;
}

export interface ToolInputRow {
  readonly label: string;
  readonly value: string;
}

export interface SingleEdit {
  readonly oldString: string;
  readonly newString: string;
  readonly replaceAll: boolean;
}

export type ToolCallInput
  = | {
    readonly kind: 'bash';
    command: string;
    description?: string | undefined;
  }
  | {
    readonly kind: 'file-write';
    path: string;
    content: string;
  }
  | {
    readonly kind: 'file-edit';
    path: string;
    oldString: string;
    newString: string;
    replaceAll: boolean;
  }
  | {
    readonly kind: 'multi-edit';
    path: string;
    edits: readonly SingleEdit[];
  }
  | {
    readonly kind: 'file-read';
    path: string;
    offset?: number | undefined;
    limit?: number | undefined;
  }
  | {
    readonly kind: 'search-files';
    tool: 'glob' | 'grep';
    pattern: string;
    searchPath?: string | undefined;
  }
  | {
    readonly kind: 'web-search';
    query: string;
  }
  | {
    readonly kind: 'web-fetch';
    url: string;
    prompt?: string | undefined;
  }
  | {
    readonly kind: 'todo-write';
    todos: readonly TodoItem[];
  }
  | {
    readonly kind: 'task';
    agentType?: string | undefined;
    description?: string | undefined;
    prompt?: string | undefined;
  }
  | {
    readonly kind: 'skill';
    skill?: string | undefined;
    prompt?: string | undefined;
  }
  | {
    readonly kind: 'generic';
    title: string;
    rows: readonly ToolInputRow[];
  };

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly serverName?: string | undefined;
  readonly input: ToolCallInput;
}

export type ToolStatus = 'ok' | 'error' | 'interrupted';

export interface PatchHunk {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly lines: readonly string[];
}

export interface ResultImage {
  readonly mediaType?: string | undefined;
  readonly data?: string | undefined;
  readonly url?: string | undefined;
}

/* A file a tool call changed, as reported by the agent that made the change. */
export interface ChangedFile {
  readonly path: string;
  readonly added: boolean;
}

export interface ToolOutcome {
  readonly toolUseId: string;
  readonly status: ToolStatus;
  readonly text?: string | undefined;
  readonly images: readonly ResultImage[];
  readonly patch?: readonly PatchHunk[] | undefined;
  readonly stdout?: string | undefined;
  readonly stderr?: string | undefined;
  readonly filePath?: string | undefined;
  /*
   * Some agents apply a patch and report afterwards which files it touched,
   * rather than naming a file in the call itself. Without this, everything that
   * counts edits would see those agents as having changed nothing.
   */
  readonly changed?: readonly ChangedFile[] | undefined;
}

export interface TextBlock {
  readonly blockType: 'text';
  readonly text: string;
}

export interface ThinkingBlock {
  readonly blockType: 'thinking';
  readonly thinking: string;
}

export interface RedactedBlock {
  readonly blockType: 'redacted';
}

export interface ToolUseBlock {
  readonly blockType: 'tool-use';
  readonly call: ToolCall;
}

export type AssistantBlock = TextBlock | ThinkingBlock | RedactedBlock | ToolUseBlock;

interface TurnBase {
  readonly uuid: string;
  readonly timestamp: string;
  readonly sidechain: boolean;
}

export interface UserTurnEntry extends TurnBase {
  readonly kind: 'user';
  readonly meta: boolean;
  readonly text: string;
  // Screenshots and files pasted into the turn, not produced by a tool.
  readonly images?: readonly ResultImage[] | undefined;
  readonly injectedText?: string | undefined;
  readonly command?: string | undefined;
  readonly outcomes: readonly ToolOutcome[];
}

export interface AssistantTurnEntry extends TurnBase {
  readonly kind: 'assistant';
  readonly model?: string | undefined;
  readonly stopReason?: string | undefined;
  readonly usage?: TokenUsage | undefined;
  readonly costUsd?: number | undefined;
  readonly durationMs?: number | undefined;
  readonly blocks: readonly AssistantBlock[];
}

export interface SystemTurnEntry {
  readonly kind: 'system';
  readonly uuid: string;
  readonly timestamp: string;
  readonly sidechain: boolean;
  readonly level?: string | undefined;
  readonly subtype?: string | undefined;
  readonly text: string;
}

export interface SummaryTurnEntry {
  readonly kind: 'summary';
  readonly text: string;
}

export type HistoryEntry
  = | UserTurnEntry
    | AssistantTurnEntry
    | SystemTurnEntry
    | SummaryTurnEntry;

export interface ProjectSummary {
  readonly agent: AgentId;
  readonly id: string;
  readonly name: string;
  readonly actualPath?: string | undefined;
  readonly sessionCount: number;
  readonly messageCount: number;
  readonly lastActivityMs: number;
}

export interface SessionSummary {
  readonly agent: AgentId;
  readonly actualSessionId: string;
  readonly id: string;
  readonly filePath: string;
  readonly projectId: string;
  readonly title?: string | undefined;
  readonly summary?: string | undefined;
  readonly preview?: string | undefined;
  readonly messageCount: number;
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
  readonly modifiedMs: number;
  readonly sizeBytes: number;
  readonly cwd?: string | undefined;
  readonly gitBranch?: string | undefined;
  /*
   * The uuid of the transcript's first message. Rewinding a session records the
   * messages up to that point again in a fresh file, so two transcripts sharing
   * a root are two recordings of one conversation rather than two conversations.
   */
  readonly rootUuid?: string | undefined;
}
