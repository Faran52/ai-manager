import { readFile, stat } from 'node:fs/promises';
import { basename, dirname } from 'node:path';

import { sumBy } from 'es-toolkit';

import { appConfig } from '@config/appConfig';

import { maxOf, minOf } from '@utils/arrayUtils';
import { parseJsonContainer } from '@utils/jsonUtils';
import { containedIn } from '@utils/pathUtils';
import { humanPreview } from '@utils/titleUtils';

import { conversationMessageCount, firstUserMessageText } from './outcomeUtils';
import { parseStructuredHistory } from './structuredUtils';
import { listTree } from './treeUtils';

import type { AgentId } from '@config/agents';
import type {
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
} from '../types';

interface EventGroup {
  readonly conversationId: string;
  readonly files: readonly string[];
}

interface OpenHandsSession {
  readonly summary: SessionSummary;
  readonly entries: readonly HistoryEntry[];
}

interface EventFile {
  readonly content: string;
  readonly modifiedMs: number;
}

interface ConversationRead {
  readonly entries: readonly HistoryEntry[];
  readonly modifiedMs: number;
  readonly sizeBytes: number;
}

/*
 * OpenHands persists one JSON file per event, so a session is the whole events/
 * folder in filename order. No project concept exists, so it groups under unknown.
 */
const EVENTS_DIR = 'events';
const EVENT_FILE = /^event-\d+-.+\.json$/u;
const UNKNOWN_PROJECT = 'unknown';

const eventGroups = async (root: string): Promise<readonly EventGroup[]> => {
  const files = await listTree(root, 8);
  const byDir = new Map<string, string[]>();

  for (const filePath of files) {
    const parent = dirname(filePath);

    if (basename(parent) === EVENTS_DIR && EVENT_FILE.test(basename(filePath))) {
      byDir.set(parent, [...byDir.get(parent) ?? [], filePath]);
    }
  }

  return [...byDir.entries()].map(([eventsDir, list]) => {
    return {
      conversationId: basename(dirname(eventsDir)),
      files: [...list].sort((left, right) => {
        return left.localeCompare(right);
      }),
    };
  });
};

const conversationEntries = async (files: readonly string[], fallbackMs: number): Promise<ConversationRead> => {
  const read = (await Promise.all(files.map(async (filePath): Promise<EventFile | null> => {
    try {
      const [content, info] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)]);

      return {
        content,
        modifiedMs: info.mtimeMs,
      };
    }
    catch {
      return null;
    }
  }))).filter((file) => {
    return file != null;
  });
  const events = read.map((file) => {
    return parseJsonContainer(file.content);
  }).filter((event) => {
    return event != null;
  });

  return {
    entries: parseStructuredHistory(JSON.stringify(events), '.json', fallbackMs),
    // The newest event mtime, not the scan time: the aggregate cache keys on it,
    // and Date.now() gave every scan a fresh key.
    modifiedMs: maxOf(read, (file) => {
      return file.modifiedMs;
    }),
    sizeBytes: sumBy(read, (file) => {
      return file.content.length;
    }),
  };
};

const openHandsSession = async (
  agent: AgentId,
  group: EventGroup,
): Promise<OpenHandsSession | undefined> => {
  const newestFile = group.files.at(-1);

  /* v8 ignore next 3 -- eventGroups never produces an empty files array */
  if (newestFile == null) {
    return undefined;
  }

  const fallbackMs = Date.now();
  const {
    entries,
    modifiedMs,
    sizeBytes,
  } = await conversationEntries(group.files, fallbackMs);

  if (entries.length === 0) {
    return undefined;
  }

  const stamps = entries.flatMap((entry) => {
    // No input here ever synthesises a summary-kind entry; only its type admits one.
    /* v8 ignore next */
    return entry.kind === 'summary' ? [] : [Date.parse(entry.timestamp)];
  }).filter(Number.isFinite);
  const preview = firstUserMessageText(entries);

  return {
    summary: {
      agent,
      actualSessionId: group.conversationId,
      id: group.conversationId,
      filePath: newestFile,
      projectId: UNKNOWN_PROJECT,
      preview: preview == null ? undefined : humanPreview(preview, appConfig.previewLength),
      messageCount: conversationMessageCount(entries),
      firstTimestampMs: minOf(stamps, (stamp) => {
        return stamp;
      }),
      lastTimestampMs: maxOf(stamps, (stamp) => {
        return stamp;
      }),
      modifiedMs,
      sizeBytes,
    },
    entries,
  };
};

export const listOpenHandsSessions = async (
  agent: AgentId,
  roots: readonly string[],
  projectId?: string,
): Promise<readonly SessionSummary[]> => {
  if (projectId != null && projectId !== UNKNOWN_PROJECT) {
    return [];
  }

  const groups = (await Promise.all(roots.map(eventGroups))).flat();

  return (await Promise.all(groups.map(async (group) => {
    return (await openHandsSession(agent, group))?.summary;
  }))).filter((summary) => {
    return summary != null;
  });
};

// ponytail: one full parse per request, same as the sessions list it reuses;
// a per-file mtime cache is the upgrade if an OpenHands history grows large.
export const listOpenHandsProjects = async (
  agent: AgentId,
  roots: readonly string[],
): Promise<readonly ProjectSummary[]> => {
  const sessions = await listOpenHandsSessions(agent, roots);

  if (sessions.length === 0) {
    return [];
  }

  return [{
    agent,
    id: UNKNOWN_PROJECT,
    name: UNKNOWN_PROJECT,
    sessionCount: sessions.length,
    messageCount: sumBy(sessions, (session) => {
      return session.messageCount;
    }),
    lastActivityMs: maxOf(sessions, (session) => {
      return session.lastTimestampMs;
    }),
  }];
};

export const loadOpenHandsEntries = async (
  filePath: string,
  allowedRoots: readonly string[],
): Promise<readonly HistoryEntry[] | undefined> => {
  if (!await containedIn(allowedRoots, filePath)) {
    return undefined;
  }

  const eventsDir = dirname(filePath);

  if (basename(eventsDir) !== EVENTS_DIR) {
    return undefined;
  }

  const groups = await eventGroups(dirname(eventsDir));
  const group = groups.find((candidate) => {
    return candidate.conversationId === basename(dirname(eventsDir));
  });

  return group == null ? undefined : (await conversationEntries(group.files, Date.now())).entries;
};
