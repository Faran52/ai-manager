import { stat } from 'node:fs/promises';

import { clamp } from 'es-toolkit';

import { agentOption } from '@config/agents';

import { LruCache } from '@utils/lruCacheUtils';

import { loadAgentEntries } from '../../agents/agentsService';
import { conversationMessageCount } from '../../history/utils/outcomeUtils';
import { SESSION_CACHE_BYTES } from '../constants';

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

interface SessionView {
  readonly entries: readonly HistoryEntry[];
  readonly messageCount: number;
}

const loadedSessions = new LruCache<LoadedSession>(SESSION_CACHE_BYTES, (session) => {
  return session.sizeBytes;
});

const isSidechained = (entry: HistoryEntry): boolean => {
  return entry.kind === 'summary' ? false : entry.sidechain;
};

// Keyed on the entries array, so a re-parse drops the derived values with it.
const sessionViews = new WeakMap<readonly HistoryEntry[], Map<boolean, SessionView>>();

const viewOf = (entries: readonly HistoryEntry[], includeSidechain: boolean): SessionView => {
  const cached = sessionViews.get(entries) ?? new Map<boolean, SessionView>();
  const hit = cached.get(includeSidechain);

  if (hit != null) {
    return hit;
  }

  const visible = includeSidechain
    ? entries
    : entries.filter((entry) => {
        return !isSidechained(entry);
      });
  const view: SessionView = {
    entries: visible,
    messageCount: conversationMessageCount(visible),
  };

  cached.set(includeSidechain, view);
  sessionViews.set(entries, cached);

  return view;
};

// A whole-history sweep passes retain false: it reads the cache but does not
// fill it, so it cannot evict the session the reader has open.
const readEntries = async (
  filePath: string,
  agent: AgentId,
  allowedRoots: readonly string[],
  retain: boolean,
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

    if (retain) {
      loadedSessions.set(filePath, {
        mtimeMs: info.mtimeMs,
        sizeBytes: info.size,
        entries,
      });
    }

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
  return (await readEntries(filePath, agent, allowedRoots, false)) ?? [];
};

export const loadSessionPage = async (
  filePath: string,
  request: PageRequest,
  agent: AgentId,
  allowedRoots: readonly string[],
): Promise<SessionPage | undefined> => {
  const entries = await readEntries(filePath, agent, allowedRoots, true);

  if (entries == null) {
    return undefined;
  }

  const { entries: visible, messageCount } = viewOf(entries, request.includeSidechain);
  const start = clamp(request.offset, 0, visible.length);
  const end = Math.min(start + Math.max(request.limit, 0), visible.length);

  return {
    entries: visible.slice(start, end),
    total: visible.length,
    messageCount,
    hasMore: end < visible.length,
    nextOffset: end,
  };
};
