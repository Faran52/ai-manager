import { appConfig } from '@config/appConfig';

import {
  listAgentProjects,
  listAgentSessions,
  pathsFor,
} from '../agents/agentsService';
import { loadSessionEntriesOrEmpty } from '../session/utils/loaderUtils';

import type { AgentId } from '@config/agents';
import type { AgentRoots } from '../agents/agentsService';
import type { HistoryEntry, SessionSummary } from '../history/types';

export interface SearchHit {
  readonly agent: AgentId;
  readonly filePath: string;
  readonly projectId: string;
  readonly sessionId: string;
  readonly role: 'user' | 'assistant' | 'system' | 'summary';
  readonly timestampMs: number;
  readonly before: string;
  readonly match: string;
  readonly after: string;
}

export interface SearchOutcome {
  readonly hits: readonly SearchHit[];
  readonly truncated: boolean;
}

interface SearchableTexts {
  readonly primary: string;
  readonly extras: readonly string[];
}

interface SessionContext {
  readonly agent: AgentId;
  readonly filePath: string;
  readonly projectId: string;
  readonly sessionId: string;
}

interface SessionHitOutcome {
  readonly capped: boolean;
  readonly hits: readonly SearchHit[];
}

type SearchSession = Pick<SessionSummary, 'filePath' | 'id'>;

const assistantText = (entry: Extract<HistoryEntry, { kind: 'assistant' }>): string => {
  return entry.blocks
    .map((block) => {
      if (block.blockType === 'text') {
        return block.text;
      }

      return block.blockType === 'thinking' ? block.thinking : '';
    })
    .join('\n');
};

const searchableFor = (entry: HistoryEntry): SearchableTexts => {
  switch (entry.kind) {
    case 'user':
      return {
        primary: entry.command ?? entry.text,
        extras: entry.outcomes.flatMap((outcome) => {
          return [outcome.text ?? '', outcome.stdout ?? '', outcome.stderr ?? ''];
        }),
      };
    case 'assistant':
      return {
        primary: assistantText(entry),
        extras: [],
      };
    case 'system':
    case 'summary':
      return {
        primary: entry.text,
        extras: [],
      };
  }
};

const firstMatchIndex = (haystack: string, needle: string): number => {
  return haystack.toLowerCase().indexOf(needle);
};

const hitFrom = (
  entry: HistoryEntry,
  texts: SearchableTexts,
  needle: string,
  session: SessionContext,
): SearchHit | undefined => {
  const candidates = [texts.primary, ...texts.extras];

  for (const candidate of candidates) {
    if (candidate.length === 0) {
      continue;
    }

    const index = firstMatchIndex(candidate, needle);

    if (index < 0) {
      continue;
    }

    const from = Math.max(0, index - appConfig.snippetPadding);
    const to = Math.min(candidate.length, index + needle.length + appConfig.snippetPadding);
    const timestampMs = entry.kind === 'summary' ? 0 : Date.parse(entry.timestamp);

    return {
      ...session,
      role: entry.kind,
      timestampMs: Number.isNaN(timestampMs) ? 0 : timestampMs,
      before: candidate.slice(from, index),
      match: candidate.slice(index, index + needle.length),
      after: candidate.slice(index + needle.length, to),
    };
  }

  return undefined;
};

const sessionHits = async (
  session: SearchSession,
  projectId: string,
  needle: string,
  agent: AgentId,
  allowedRoots: readonly string[],
): Promise<SessionHitOutcome> => {
  const entries = await loadSessionEntriesOrEmpty(session.filePath, agent, allowedRoots);
  const context: SessionContext = {
    agent,
    filePath: session.filePath,
    projectId,
    sessionId: session.id,
  };
  const hits: SearchHit[] = [];

  for (const entry of entries) {
    if (hits.length >= appConfig.maxMatchesPerFile) {
      return {
        hits,
        capped: true,
      };
    }

    const hit = hitFrom(entry, searchableFor(entry), needle, context);

    if (hit != null) {
      hits.push(hit);
    }
  }

  return {
    hits,
    capped: false,
  };
};

export const searchAgentHistory = async (
  roots: AgentRoots,
  query: string,
  projectId?: string,
): Promise<SearchOutcome> => {
  const needle = query.trim().toLowerCase();

  if (needle.length === 0) {
    return {
      hits: [],
      truncated: false,
    };
  }

  const hits: SearchHit[] = [];
  const projects = (await listAgentProjects(roots)).filter((project) => {
    return projectId == null || project.id === projectId;
  });
  const projectKeys = new Set(projects.map((project) => {
    return `${project.agent}:${project.id}`;
  }));
  const agents = [...new Set(projects.map((project) => {
    return project.agent;
  }))];

  for (const agent of agents) {
    const sessions = (await listAgentSessions(roots, agent)).filter((session) => {
      return projectKeys.has(`${agent}:${session.projectId}`);
    });

    for (const session of sessions) {
      const found = await sessionHits(session, session.projectId, needle, agent, pathsFor(roots, agent));

      hits.push(...found.hits);

      if (hits.length >= appConfig.maxSearchResults) {
        return {
          hits: hits.slice(0, appConfig.maxSearchResults),
          truncated: true,
        };
      }

      if (found.capped) {
        return {
          hits,
          truncated: true,
        };
      }
    }
  }

  return {
    hits,
    truncated: false,
  };
};
