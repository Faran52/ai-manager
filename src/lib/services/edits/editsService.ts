import {
  listAgentSessions,
  loadAgentEntries,
  pathsFor,
} from '../agents/agentsService';

import type { AgentId } from '@config/agents';
import type { AgentRoots } from '../agents/agentsService';
import type { HistoryEntry, ToolCallInput } from '../history/types';

export type EditKind = 'edit' | 'write';

export interface FileEdit {
  readonly kind: EditKind;
  readonly sessionId: string;
  readonly sessionTitle: string;
  readonly sessionFilePath: string;
  readonly timestampMs: number;
  readonly changes: number;
}

export interface EditedFile {
  readonly path: string;
  readonly edits: number;
  readonly writes: number;
  readonly sessionCount: number;
  readonly lastEditedMs: number;
  readonly recent: readonly FileEdit[];
}

interface EditTarget {
  readonly path: string;
  readonly kind: EditKind;
  readonly changes: number;
}

interface FileAccumulator {
  path: string;
  edits: number;
  writes: number;
  sessions: Set<string>;
  lastEditedMs: number;
  recent: FileEdit[];
}

// A project's whole history can be thousands of transcripts, and this view only
// answers "what changed lately", so the newest sessions are enough.
const SESSION_SCAN_LIMIT = 40;
const RECENT_PER_FILE = 8;
const MAX_FILES = 200;

// A tool call with no path is noise: the parser fills one in as empty rather than dropping the call.
const targetOf = (input: ToolCallInput): EditTarget | undefined => {
  if ('path' in input && input.path.length === 0) {
    return undefined;
  }

  switch (input.kind) {
    case 'file-edit':
      return {
        path: input.path,
        kind: 'edit',
        changes: 1,
      };
    case 'multi-edit':
      return {
        path: input.path,
        kind: 'edit',
        changes: input.edits.length,
      };
    case 'file-write':
      return {
        path: input.path,
        kind: 'write',
        changes: 1,
      };
    default:
      return undefined;
  }
};

const editsInEntry = (entry: HistoryEntry): readonly EditTarget[] => {
  if (entry.kind !== 'assistant') {
    return [];
  }

  return entry.blocks.flatMap((block) => {
    if (block.blockType !== 'tool-use') {
      return [];
    }

    const target = targetOf(block.call.input);

    return target == null ? [] : [target];
  });
};

const record = (
  files: Map<string, FileAccumulator>,
  target: EditTarget,
  edit: FileEdit,
): void => {
  const existing = files.get(target.path) ?? {
    path: target.path,
    edits: 0,
    writes: 0,
    sessions: new Set<string>(),
    lastEditedMs: 0,
    recent: [],
  };

  existing.edits += target.kind === 'edit' ? target.changes : 0;
  existing.writes += target.kind === 'write' ? 1 : 0;
  existing.sessions.add(edit.sessionId);
  existing.lastEditedMs = Math.max(existing.lastEditedMs, edit.timestampMs);
  existing.recent.push(edit);
  files.set(target.path, existing);
};

export const listRecentEdits = async (
  roots: AgentRoots,
  agent: AgentId,
  projectId: string,
): Promise<readonly EditedFile[]> => {
  const agentDirs = pathsFor(roots, agent);
  const sessions = [...await listAgentSessions(roots, agent, projectId)]
    .sort((left, right) => {
      return right.lastTimestampMs - left.lastTimestampMs;
    })
    .slice(0, SESSION_SCAN_LIMIT);
  const files = new Map<string, FileAccumulator>();

  for (const session of sessions) {
    const entries = await loadAgentEntries(session.filePath, agent, agentDirs) ?? [];
    const title = session.title ?? session.summary ?? session.preview ?? session.id;

    for (const entry of entries) {
      const timestampMs = entry.kind === 'summary' ? 0 : Date.parse(entry.timestamp);

      for (const target of editsInEntry(entry)) {
        record(files, target, {
          kind: target.kind,
          sessionId: session.id,
          sessionTitle: title,
          sessionFilePath: session.filePath,
          timestampMs: Number.isNaN(timestampMs) ? session.lastTimestampMs : timestampMs,
          changes: target.changes,
        });
      }
    }
  }

  return [...files.values()]
    .sort((left, right) => {
      return right.lastEditedMs - left.lastEditedMs;
    })
    .slice(0, MAX_FILES)
    .map((file) => {
      return {
        path: file.path,
        edits: file.edits,
        writes: file.writes,
        sessionCount: file.sessions.size,
        lastEditedMs: file.lastEditedMs,
        recent: [...file.recent]
          .sort((left, right) => {
            return right.timestampMs - left.timestampMs;
          })
          .slice(0, RECENT_PER_FILE),
      };
    });
};
