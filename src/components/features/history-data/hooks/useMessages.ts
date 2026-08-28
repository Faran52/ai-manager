import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { appConfig } from '@config/appConfig';

import { fetchMessages } from '@lib/apis/apiClient';
import { toErrorMessage } from '@utils/errorUtils';

import type { AgentId } from '@config/agents';
import type { HistoryEntry } from '@services/history/historyService';
import type { SessionPage } from '@services/session/sessionService';
import type { Dispatch, SetStateAction } from 'react';

type FeedPhase = 'loading' | 'refreshing' | 'ready' | 'error';

interface Feed {
  phase: FeedPhase;
  readonly filePath: string | null;
  readonly agent: AgentId;
  readonly includeSidechain: boolean;
  offset: number;
  entries: readonly HistoryEntry[];
  total: number;
  messageCount: number;
  hasMore: boolean;
  error?: string | undefined;
}

export interface MessageFeed {
  readonly phase: FeedPhase;
  readonly entries: readonly HistoryEntry[];
  readonly messageCount: number;
  readonly total: number;
  readonly hasMore: boolean;
  readonly error: string | undefined;
  readonly syncing: boolean;
  readonly loadMore: () => void;
}

const freshFeed = (filePath: string | null, agent: AgentId, includeSidechain: boolean): Feed => {
  return {
    phase: filePath == null ? 'ready' : 'loading',
    filePath,
    agent,
    includeSidechain,
    offset: 0,
    entries: [],
    total: 0,
    messageCount: 0,
    hasMore: false,
  };
};

const mergePage = (current: Feed, page: SessionPage): Feed => {
  const entries = current.offset === 0 ? page.entries : [...current.entries, ...page.entries];

  return {
    ...current,
    phase: 'ready',
    entries,
    total: page.total,
    messageCount: page.messageCount,
    hasMore: page.hasMore,
    offset: page.nextOffset,
  };
};

const failFeed = (current: Feed, message: string): Feed => {
  return {
    ...current,
    phase: 'error',
    error: message,
    total: 0,
    messageCount: 0,
    hasMore: false,
    offset: 0,
    entries: [],
  };
};

const refreshFeed = async (feed: Feed, setState: Dispatch<SetStateAction<Feed>>): Promise<void> => {
  try {
    const page = await fetchMessages({
      filePath:
        // v8 ignore next -- unreachable by construction
        feed.filePath ?? '',
      agent: feed.agent,
      offset: 0,
      limit: Math.max(
        feed.offset + (feed.hasMore ? 0 : appConfig.pageSize),
        appConfig.pageSize,
      ),
      includeSidechain: feed.includeSidechain,
    });

    setState((current) => {
      return {
        ...current,
        phase: 'ready',
        entries: page.entries,
        total: page.total,
        messageCount: page.messageCount,
        hasMore: page.hasMore,
        offset: page.nextOffset,
      };
    });
  }
  catch {
    setState((current) => {
      return {
        ...current,
        phase: 'ready',
      };
    });
  }
};

const runLoad = async (feed: Feed, setState: Dispatch<SetStateAction<Feed>>): Promise<void> => {
  try {
    const page = await fetchMessages({
      filePath:
        // v8 ignore next -- unreachable by construction
        feed.filePath ?? '',
      agent: feed.agent,
      offset: feed.offset,
      limit: appConfig.pageSize,
      includeSidechain: feed.includeSidechain,
    });

    setState((current) => {
      return mergePage(current, page);
    });
  }
  catch (cause) {
    setState((current) => {
      return failFeed(current, toErrorMessage(cause));
    });
  }
};

export const useMessages = (
  filePath: string | null,
  agentOrIncludeSidechain: AgentId | boolean,
  requestedIncludeSidechain?: boolean,
  sourceModifiedMs = 0,
): MessageFeed => {
  const agent = typeof agentOrIncludeSidechain === 'boolean' ? 'claude' : agentOrIncludeSidechain;
  const includeSidechain = typeof agentOrIncludeSidechain === 'boolean'
    ? agentOrIncludeSidechain
    : requestedIncludeSidechain === true;
  const [feed, setFeed] = useState<Feed>(() => {
    return freshFeed(filePath, agent, includeSidechain);
  });
  const [prevKey, setPrevKey] = useState(`${agent}::${String(filePath)}::${String(includeSidechain)}`);
  const [prevSourceModifiedMs, setPrevSourceModifiedMs] = useState(sourceModifiedMs);
  const key = `${agent}::${String(filePath)}::${String(includeSidechain)}`;

  if (key !== prevKey) {
    setPrevKey(key);
    setFeed(freshFeed(filePath, agent, includeSidechain));
  }

  if (sourceModifiedMs !== prevSourceModifiedMs) {
    setPrevSourceModifiedMs(sourceModifiedMs);
    setFeed((current) => {
      return current.filePath == null || current.phase === 'loading'
        ? current
        : {
            ...current,
            phase: 'refreshing',
          };
    });
  }

  useEffect(() => {
    if (feed.phase !== 'loading' && feed.phase !== 'refreshing') {
      return undefined;
    }

    let active = true;

    const load = feed.phase === 'refreshing' ? refreshFeed : runLoad;

    void load(feed, (next) => {
      if (active) {
        setFeed(next);
      }
    });

    return () => {
      active = false;
    };
  }, [feed]);

  const loadMore = useCallback((): void => {
    setFeed((current) => {
      return current.hasMore && current.phase === 'ready'
        ? {
            ...current,
            phase: 'loading',
          }
        : current;
    });
  }, []);

  return {
    phase: (feed.phase === 'loading' && feed.entries.length > 0) || feed.phase === 'refreshing'
      ? 'ready'
      : feed.phase,
    entries: feed.entries,
    messageCount: feed.messageCount,
    total: feed.total,
    hasMore: feed.hasMore,
    error: feed.error,
    syncing: feed.phase === 'refreshing',
    loadMore,
  };
};
