import { stat } from 'node:fs/promises';

import { agentOption } from '@config/agents';

import { LruCache } from '@utils/lruCacheUtils';

import { loadAgentEntries } from '../../agents/agentsService';
import { conversationMessageCount } from '../../history/utils/outcomeUtils';

import type { AgentId } from '@config/agents';
import type { HistoryEntry } from '../../history/types';

export interface PageRequest {
  readonly offset: number;
  readonly limit: number;
  readonly includeSidechain: boolean;
}

export interface SessionPage {
  readonly entries: readonly HistoryEntry[];
  readonly total: number;
  readonly messageCount: number;
  readonly hasMore: boolean;
  readonly nextOffset: number;
}

interface LoadedSession {
  readonly mtimeMs: number;
  readonly sizeBytes: number;
  readonly entries: readonly HistoryEntry[];
}

const loadedSessions = new LruCache<LoadedSession>(64);

const isSidechained = (entry: HistoryEntry): boolean => {
  return entry.kind === 'summary' ? false : entry.sidechain;
};

const readEntries = async (
  filePath: string,
  agent: AgentId,
  allowedRoots: readonly string[],
): Promise<readonly HistoryEntry[] | undefined> => {
  try {
    // Database-backed formats hand out synthetic references (`sqlite:`/`oc:`), so
    // there is no file to stat; their loaders do their own containment checks.
    if (agentOption(agent).format === 'sqlite' || agentOption(agent).format === 'opencode') {
      return await loadAgentEntries(filePath, agent, allowedRoots);
    }

    const info = await stat(filePath);
    const cached = loadedSessions.get(filePath);

    if (cached?.mtimeMs === info.mtimeMs && cached.sizeBytes === info.size) {
      return cached.entries;
    }

    const entries = await loadAgentEntries(filePath, agent, allowedRoots);

    if (entries == null) {
      return undefined;
    }

    loadedSessions.set(filePath, {
      mtimeMs: info.mtimeMs,
      sizeBytes: info.size,
      entries,
    });

    return entries;
  }
  catch {
    return undefined;
  }
};

export const loadSessionEntriesOrEmpty = async (
  filePath: string,
  agent: AgentId,
  allowedRoots: readonly string[],
): Promise<readonly HistoryEntry[]> => {
  return (await readEntries(filePath, agent, allowedRoots)) ?? [];
};

export const loadSessionPage = async (
  filePath: string,
  request: PageRequest,
  agent: AgentId,
  allowedRoots: readonly string[],
): Promise<SessionPage | undefined> => {
  const entries = await readEntries(filePath, agent, allowedRoots);

  if (entries == null) {
    return undefined;
  }

  const visible = request.includeSidechain
    ? entries
    : entries.filter((entry) => {
        return !isSidechained(entry);
      });
  const start = Math.min(Math.max(request.offset, 0), visible.length);
  const end = Math.min(start + Math.max(request.limit, 0), visible.length);

  return {
    entries: visible.slice(start, end),
    total: visible.length,
    messageCount: conversationMessageCount(visible),
    hasMore: end < visible.length,
    nextOffset: end,
  };
};
