import { agentOption } from '@config/agents';

import {
  listAgentProjects,
  pathsFor,
  readModelCosts,
} from '../agents/agentsService';
import { listSessions } from '../history/utils/claudeUtils';
import { listCodexSessions } from '../history/utils/codexUtils';
import { listCopilotSessions } from '../history/utils/copilotUtils';
import { listOpenCodeSessions } from '../history/utils/openCodeUtils';
import { listSqliteSessions } from '../history/utils/sqliteUtils';
import { listStructuredSessions } from '../history/utils/structuredUtils';
import { loadSessionEntriesOrEmpty } from '../session/utils/loaderUtils';

import {
  aggregateSession,
  cachedAggregate,
  createAccumulator,
  foldAggregate,
} from './utils/aggregateUtils';
import { summarizePricing } from './utils/pricingUtils';
import { effortFrom, rhythmFrom } from './utils/rhythmUtils';

import type { AgentId } from '@config/agents';
import type { AgentRoots, ModelCost } from '../agents/agentsService';
import type { ProjectSummary, SessionSummary } from '../history/types';
import type {
  Accumulator,
  DayActivity,
  SessionAggregate,
  SessionTokenTotals,
  ToolUsage,
} from './utils/aggregateUtils';
import type { PricedModelUsage } from './utils/pricingUtils';
import type { StatsEffort, StatsRhythm } from './utils/rhythmUtils';

export type StatsModelUsage = PricedModelUsage;

export interface StatsTotals {
  readonly usageRecorded: boolean;
  readonly sessions: number;
  readonly messages: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationTokens: number;
  readonly cacheReadTokens: number;
  readonly conversationTokens?: number | undefined;
  readonly nonConversationTokens?: number | undefined;
  readonly billingTokens?: number | undefined;
  readonly splitUnavailable?: boolean | undefined;
  readonly pricingCoveragePercent?: number | undefined;
  readonly unpricedModelCount?: number | undefined;
  readonly costUsd: number;
  readonly durationMs: number;
}

export interface ProjectStats {
  readonly projectId: string;
  readonly totals: StatsTotals;
  readonly models: readonly StatsModelUsage[];
  readonly tools: readonly ToolUsage[];
  readonly skills: readonly ToolUsage[];
  readonly subagents: readonly ToolUsage[];
  readonly activity: readonly DayActivity[];
  readonly topSessions: readonly SessionTokenTotals[];
  readonly rhythm: StatsRhythm;
  readonly effort: StatsEffort;
}

export interface CompleteStatsTotals extends StatsTotals {
  readonly conversationTokens: number;
  readonly nonConversationTokens: number;
  readonly billingTokens: number;
  readonly splitUnavailable: boolean;
  readonly pricingCoveragePercent: number;
  readonly unpricedModelCount: number;
}

interface CompleteProjectStats extends ProjectStats {
  readonly totals: CompleteStatsTotals;
}

export interface AgentStatsUsage {
  readonly agent: AgentId;
  readonly tokens: number;
  readonly sessions: number;
  readonly projects: number;
}

export interface GlobalStats extends ProjectStats {
  readonly totals: CompleteStatsTotals;
  readonly agents: readonly AgentStatsUsage[];
}

interface AgentAccumulator {
  readonly accumulator: Accumulator;
  projects: number;
}

interface CountedSession {
  readonly session: SessionSummary;
  readonly aggregate: SessionAggregate;
}

export type {
  DayActivity,
  SessionTokenTotals,
  ToolUsage,
} from './utils/aggregateUtils';
export type {
  StatsEffort,
  StatsRhythm,
} from './utils/rhythmUtils';

// Counters keyed by name, heaviest first, which is the shape every usage list
// in the report reads from.
const rankedUsage = (counts: ReadonlyMap<string, number>): readonly ToolUsage[] => {
  return [...counts.entries()]
    .map(([tool, count]) => {
      return {
        tool,
        count,
      };
    })
    .sort((left, right) => {
      return right.count - left.count;
    });
};

const sessionsForStats = async (
  agentDirs: readonly string[],
  projectId: string,
  agent: AgentId,
): Promise<readonly SessionSummary[]> => {
  const format = agentOption(agent).format;

  if (format === 'copilot') {
    return listCopilotSessions(agent, agentDirs, projectId);
  }

  if (format === 'opencode') {
    return listOpenCodeSessions(agent, agentDirs, projectId);
  }

  if (format === 'codex') {
    const sessions = await Promise.all(agentDirs.map(async (agentDir) => {
      return listCodexSessions(agentDir, projectId);
    }));

    return sessions.flat();
  }

  if (format === 'claude') {
    const sessions = await Promise.all(agentDirs.map(async (agentDir) => {
      return listSessions(agentDir, projectId);
    }));

    return sessions.flat();
  }

  return format === 'sqlite'
    ? listSqliteSessions(agent, agentDirs, projectId)
    : listStructuredSessions(agent, agentDirs, projectId);
};

const splitAvailableFor = (agent: AgentId): boolean => {
  const format = agentOption(agent).format;

  return format === 'claude' || format === 'codex' || format === 'opencode';
};

const aggregateFor = async (
  session: SessionSummary,
  agent: AgentId,
  agentDirs: readonly string[],
): Promise<SessionAggregate> => {
  return cachedAggregate(session, async () => {
    return aggregateSession(
      await loadSessionEntriesOrEmpty(session.filePath, agent, agentDirs),
      splitAvailableFor(agent),
    );
  });
};

const addSession = async (
  accumulators: readonly Accumulator[],
  session: SessionSummary,
  agent: AgentId,
  agentDirs: readonly string[],
): Promise<void> => {
  const aggregate = await aggregateFor(session, agent, agentDirs);

  for (const accumulator of accumulators) {
    foldAggregate(accumulator, aggregate, session);
  }
};

/**
 * One project's whole contribution, counted before anything is folded in.
 * Projects are read at the same time because each waits mostly on the disk;
 * their sessions are read one after another so a large history cannot open
 * every transcript it owns at once.
 */
const countProject = async (
  project: ProjectSummary,
  roots: AgentRoots,
): Promise<readonly CountedSession[]> => {
  const agentDirs = pathsFor(roots, project.agent);
  const sessions = await sessionsForStats(agentDirs, project.id, project.agent);
  const counted: CountedSession[] = [];

  for (const session of sessions) {
    counted.push({
      session,
      aggregate: await aggregateFor(session, project.agent, agentDirs),
    });
  }

  return counted;
};

const projectStatsFrom = (
  projectId: string,
  accumulator: Accumulator,
  costs: ReadonlyMap<string, ModelCost>,
): CompleteProjectStats => {
  const pricing = summarizePricing(accumulator.pricingEntries, costs);
  const topSessions = [...accumulator.perSession].sort((left, right) => {
    return right.tokens - left.tokens || right.messages - left.messages;
  }).slice(0, 5);
  const activity = [...accumulator.days.values()].sort((left, right) => {
    return left.date.localeCompare(right.date);
  });

  return {
    projectId,
    totals: {
      usageRecorded: accumulator.usageRecorded,
      sessions: accumulator.sessions,
      messages: accumulator.messages,
      inputTokens: accumulator.inputTokens,
      outputTokens: accumulator.outputTokens,
      cacheCreationTokens: accumulator.cacheCreationTokens,
      cacheReadTokens: accumulator.cacheReadTokens,
      conversationTokens: accumulator.conversationTokens,
      nonConversationTokens: accumulator.nonConversationTokens,
      billingTokens: accumulator.billingTokens,
      splitUnavailable: accumulator.splitUnavailable,
      pricingCoveragePercent: pricing.coveragePercent,
      unpricedModelCount: pricing.unpricedModelCount,
      costUsd: pricing.costUsd,
      durationMs: accumulator.durationMs,
    },
    models: pricing.models,
    tools: rankedUsage(accumulator.tools),
    skills: rankedUsage(accumulator.skills),
    subagents: rankedUsage(accumulator.subagents),
    activity,
    topSessions,
    rhythm: rhythmFrom(activity, accumulator.hours, accumulator.weekdays, Date.now()),
    effort: effortFrom(accumulator.tools, accumulator.userMessages, accumulator.userChars),
  };
};

export const computeProjectStats = async (
  agentDir: string | readonly string[],
  projectId: string,
  agent: AgentId = 'claude',
): Promise<ProjectStats | undefined> => {
  const agentDirs = typeof agentDir === 'string' ? [agentDir] : agentDir;
  const sessions = await sessionsForStats(agentDirs, projectId, agent);

  if (sessions.length === 0) {
    return undefined;
  }

  const accumulator = createAccumulator();

  for (const session of sessions) {
    await addSession([accumulator], session, agent, agentDirs);
  }

  return projectStatsFrom(projectId, accumulator, await readModelCosts());
};

export const computeGlobalStats = async (roots: AgentRoots): Promise<GlobalStats> => {
  const projects = await listAgentProjects(roots);
  const counted = await Promise.all(projects.map(async (project) => {
    return {
      project,
      sessions: await countProject(project, roots),
    };
  }));
  const globalAccumulator = createAccumulator();
  const byAgent = new Map<AgentId, AgentAccumulator>();

  for (const { project, sessions } of counted) {
    const agentAccumulator = byAgent.get(project.agent) ?? {
      accumulator: createAccumulator(),
      projects: 0,
    };

    agentAccumulator.projects += 1;
    byAgent.set(project.agent, agentAccumulator);

    for (const entry of sessions) {
      foldAggregate(globalAccumulator, entry.aggregate, entry.session);
      foldAggregate(agentAccumulator.accumulator, entry.aggregate, entry.session);
    }
  }

  return {
    ...projectStatsFrom('global', globalAccumulator, await readModelCosts()),
    agents: [...byAgent.entries()].map(([agent, value]) => {
      return {
        agent,
        tokens: value.accumulator.billingTokens,
        sessions: value.accumulator.sessions,
        projects: value.projects,
      };
    }).sort((left, right) => {
      return right.tokens - left.tokens;
    }),
  };
};
