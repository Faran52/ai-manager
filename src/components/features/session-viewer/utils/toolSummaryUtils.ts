import { mcpToolIdentity } from './mcpToolUtils';

import type { ToolCall, ToolOutcome } from '@services/history/historyService';

// The colour family a card wears. A transcript is mostly tool calls, so the
// eye needs to sort them by shape before reading a word of the header.
export type ToolTone = 'code' | 'search' | 'shell' | 'web' | 'plug' | 'plain';

export interface ToolSummary {
  // The tool's own name, shown verbatim, because that is what the user typed or read.
  readonly label: string;
  // What the call acted on: a file, a pattern, a command. Empty when there is nothing worth naming.
  readonly detail: string;
  readonly tone: ToolTone;
}

const DETAIL_MAX = 90;

const baseName = (path: string): string => {
  let cleaned = path;

  while (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned.slice(cleaned.lastIndexOf('/') + 1);
};

// One separator everywhere, applied after the collapse so it survives it.
const detailOf = (...parts: readonly string[]): string => {
  const joined = parts
    .map((part) => {
      return part.replaceAll(/\s+/gu, ' ').trim();
    })
    .filter((part) => {
      return part.length > 0;
    })
    .join(' · ');

  return joined.length <= DETAIL_MAX ? joined : `${joined.slice(0, DETAIL_MAX - 1)}…`;
};

// Read takes a window, and which window it took is half of what the call meant.
const readRange = (offset: number | undefined, limit: number | undefined): string => {
  if (offset == null && limit == null) {
    return '';
  }

  const start = offset ?? 1;

  return limit == null ? ` (L${String(start)}–)` : ` (L${String(start)}–${String(start + limit)})`;
};

const patchTotals = (outcome: ToolOutcome | undefined): string => {
  const hunks = outcome?.patch;

  if (hunks == null) {
    return '';
  }

  let added = 0;
  let removed = 0;

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      added += line.startsWith('+') ? 1 : 0;
      removed += line.startsWith('-') ? 1 : 0;
    }
  }

  return added + removed === 0 ? '' : `+${String(added)} −${String(removed)}`;
};

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  }
  catch {
    return url;
  }
};

export const toolSummary = (call: ToolCall, outcome?: ToolOutcome): ToolSummary => {
  const mcp = mcpToolIdentity(call);

  if (mcp != null) {
    return {
      label: mcp.tool,
      detail: mcp.server,
      tone: 'plug',
    };
  }

  const { input } = call;

  switch (input.kind) {
    case 'file-read':
      return {
        label: call.name,
        detail: detailOf(baseName(input.path) + readRange(input.offset, input.limit)),
        tone: 'code',
      };
    case 'file-write':
      return {
        label: call.name,
        detail: detailOf(baseName(input.path)),
        tone: 'code',
      };
    case 'file-edit':
      return {
        label: call.name,
        detail: detailOf(baseName(input.path), patchTotals(outcome)),
        tone: 'code',
      };
    case 'multi-edit':
      return {
        label: call.name,
        detail: detailOf(baseName(input.path), `×${String(input.edits.length)}`),
        tone: 'code',
      };
    case 'search-files':
      return {
        label: call.name,
        detail: detailOf(input.pattern, input.searchPath == null ? '' : baseName(input.searchPath)),
        tone: 'search',
      };
    case 'bash':
      return {
        label: call.name,
        detail: detailOf(input.command),
        tone: 'shell',
      };
    case 'web-search':
      return {
        label: call.name,
        detail: detailOf(input.query),
        tone: 'web',
      };
    case 'web-fetch':
      return {
        label: call.name,
        detail: detailOf(hostOf(input.url)),
        tone: 'web',
      };
    case 'task':
      return {
        label: call.name,
        detail: detailOf(input.agentType ?? input.description ?? ''),
        tone: 'plain',
      };
    case 'todo-write':
      return {
        label: call.name,
        detail: `×${String(input.todos.length)}`,
        tone: 'plain',
      };
    case 'generic':
      return {
        label: call.name,
        detail: '',
        tone: 'plain',
      };
  }
};
