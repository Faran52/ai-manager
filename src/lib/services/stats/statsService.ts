import { agentOption } from '@config/agents';

import { listAgentProjects, pathsFor } from '../agents/agentsService';
import { listSessions } from '../history/utils/claudeUtils';
import { listCodexSessions } from '../history/utils/codexUtils';
import { listCopilotSessions } from '../history/utils/copilotUtils';
import { listOpenCodeSessions } from '../history/utils/openCodeUtils';
import { listSqliteSessions } from '../history/utils/sqliteUtils';
import { listStructuredSessions } from '../history/utils/structuredUtils';
import { loadSessionEntriesOrEmpty } from '../session/utils/loaderUtils';

import { summarizePricing } from './pricingUtils';

import type { AgentId } from '@config/agents';
import type { AgentRoots } from '../agents/agentsService';
import type {
  HistoryEntry,
  SessionSummary,
  TokenUsage,
} from '../history/types';
import type { PricedModelUsage, PricingEntry } from './pricingUtils';

type TurnEntry = Extract<HistoryEntry, { kind: 'user' | 'assistant' }>;

export type StatsModelUsage = PricedModelUsage;

export interface ToolUsage {
  readonly tool: string;
  readonly count: number;
}

export interface DayActivity {
  readonly date: string;
  readonly messages: number;
  readonly tokens: number;
}

export interface SessionTokenTotals {
  readonly filePath: string;
  readonly sessionId: string;
  readonly title?: string | undefined;
  readonly tokens: number;
  readonly messages: number;
  readonly lastTimestampMs: number;
}

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
  readonly activity: readonly DayActivity[];
  readonly topSessions: readonly SessionTokenTotals[];
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

interface Accumulator {
  usageRecorded: boolean;
  sessions: number;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  conversationTokens: number;
  nonConversationTokens: number;
  billingTokens: number;
  splitUnavailable: boolean;
  durationMs: number;
  pricingEntries: PricingEntry[];
  tools: Map<string, number>;
  days: Map<string, DayActivity>;
  perSession: SessionTokenTotals[];
}

interface AgentAccumulator {
  readonly accumulator: Accumulator;
  projects: number;
}

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

const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
};

const totalTokens = (usage: TokenUsage): number => {
  return usage.inputTokens + usage.outputTokens + usage.cacheCreationTokens + usage.cacheReadTokens;
};

const createAccumulator = (): Accumulator => {
  return {
    usageRecorded: false,
    sessions: 0,
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    conversationTokens: 0,
    nonConversationTokens: 0,
    billingTokens: 0,
    splitUnavailable: false,
    durationMs: 0,
    pricingEntries: [],
    tools: new Map(),
    days: new Map(),
    perSession: [],
  };
};

const splitAvailableFor = (agent: AgentId): boolean => {
  const format = agentOption(agent).format;

  return format === 'claude' || format === 'codex' || format === 'opencode';
};

const dayKeyOf = (entry: TurnEntry): string | undefined => {
  const day = entry.timestamp.slice(0, 10);

  return day.length === 10 ? day : undefined;
};

const addUsage = (
  accumulator: Accumulator,
  entry: HistoryEntry,
  splitAvailable: boolean,
): void => {
  if (entry.kind !== 'assistant') {
    return;
  }

  accumulator.messages += 1;
  accumulator.usageRecorded ||= entry.usage != null
    || entry.costUsd != null
    || entry.durationMs != null;

  const usage = entry.usage ?? EMPTY_USAGE;
  const conversationTokens = usage.inputTokens + usage.outputTokens;
  const nonConversationTokens = usage.cacheCreationTokens + usage.cacheReadTokens;
  const billingTokens = conversationTokens + nonConversationTokens;
  const model = entry.model ?? 'unknown';

  accumulator.inputTokens += usage.inputTokens;
  accumulator.outputTokens += usage.outputTokens;
  accumulator.cacheCreationTokens += usage.cacheCreationTokens;
  accumulator.cacheReadTokens += usage.cacheReadTokens;
  accumulator.conversationTokens += splitAvailable ? conversationTokens : billingTokens;
  accumulator.nonConversationTokens += splitAvailable ? nonConversationTokens : 0;
  accumulator.billingTokens += billingTokens;
  accumulator.splitUnavailable ||= !splitAvailable && entry.usage != null;
  accumulator.durationMs += entry.durationMs ?? 0;
  accumulator.pricingEntries.push({
    model,
    inputTokens: usage.inputTokens + usage.cacheCreationTokens + usage.cacheReadTokens,
    outputTokens: usage.outputTokens,
    costUsd: entry.costUsd,
  });

  for (const block of entry.blocks) {
    if (block.blockType !== 'tool-use') {
      continue;
    }

    accumulator.tools.set(block.call.name, (accumulator.tools.get(block.call.name) ?? 0) + 1);
  }
};

const addActivity = (accumulator: Accumulator, rawEntry: HistoryEntry): void => {
  if (rawEntry.kind !== 'user' && rawEntry.kind !== 'assistant') {
    return;
  }

  const entry: TurnEntry = rawEntry;
  const day = dayKeyOf(entry);

  if (day == null) {
    return;
  }

  const usage = entry.kind === 'assistant' ? (entry.usage ?? EMPTY_USAGE) : EMPTY_USAGE;
  const existing = accumulator.days.get(day) ?? {
    date: day,
    messages: 0,
    tokens: 0,
  };

  accumulator.days.set(day, {
    date: day,
    messages: existing.messages + 1,
    tokens: existing.tokens + (entry.kind === 'assistant' ? totalTokens(usage) : 0),
  });
};

const addSession = async (
  accumulators: readonly Accumulator[],
  session: SessionSummary,
  agent: AgentId,
  agentDirs: readonly string[],
): Promise<void> => {
  const entries = await loadSessionEntriesOrEmpty(session.filePath, agent, agentDirs);
  const splitAvailable = splitAvailableFor(agent);
  let messages = 0;
  let tokens = 0;

  for (const entry of entries) {
    for (const accumulator of accumulators) {
      addUsage(accumulator, entry, splitAvailable);
      addActivity(accumulator, entry);
    }

    if (entry.kind === 'assistant') {
      messages += 1;
      tokens += totalTokens(entry.usage ?? EMPTY_USAGE);
    }
  }

  for (const accumulator of accumulators) {
    accumulator.sessions += 1;
    accumulator.perSession.push({
      filePath: session.filePath,
      sessionId: session.id,
      title: session.title ?? session.summary ?? session.preview,
      tokens,
      messages,
      lastTimestampMs: session.lastTimestampMs,
    });
  }
};

const projectStatsFrom = (projectId: string, accumulator: Accumulator): CompleteProjectStats => {
  const pricing = summarizePricing(accumulator.pricingEntries);
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
    tools: [...accumulator.tools.entries()]
      .map(([tool, count]) => {
        return {
          tool,
          count,
        };
      })
      .sort((left, right) => {
        return right.count - left.count;
      }),
    activity,
    topSessions,
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

  return projectStatsFrom(projectId, accumulator);
};

export const computeGlobalStats = async (roots: AgentRoots): Promise<GlobalStats> => {
  const projects = await listAgentProjects(roots);
  const globalAccumulator = createAccumulator();
  const byAgent = new Map<AgentId, AgentAccumulator>();

  for (const project of projects) {
    const agentAccumulator = byAgent.get(project.agent) ?? {
      accumulator: createAccumulator(),
      projects: 0,
    };

    agentAccumulator.projects += 1;
    byAgent.set(project.agent, agentAccumulator);

    const agentDirs = pathsFor(roots, project.agent);
    const sessions = await sessionsForStats(agentDirs, project.id, project.agent);

    for (const session of sessions) {
      await addSession(
        [globalAccumulator, agentAccumulator.accumulator],
        session,
        project.agent,
        agentDirs,
      );
    }
  }

  return {
    ...projectStatsFrom('global', globalAccumulator),
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
