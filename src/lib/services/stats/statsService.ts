import { agentOption } from '@config/agents';

import { listSessions } from '../history/utils/claudeUtils';
import { listCodexSessions } from '../history/utils/codexUtils';
import { listSqliteSessions } from '../history/utils/sqliteUtils';
import { listStructuredSessions } from '../history/utils/structuredUtils';
import { loadSessionEntriesOrEmpty } from '../session/utils/loaderUtils';

import type { AgentId } from '@config/agents';
import type {
  HistoryEntry,
  SessionSummary,
  TokenUsage,
} from '../history/types';

type TurnEntry = Extract<HistoryEntry, { kind: 'user' | 'assistant' }>;

export interface StatsModelUsage {
  readonly model: string;
  readonly requests: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

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

export interface ProjectStats {
  readonly projectId: string;
  readonly totals: {
    readonly usageRecorded: boolean;
    readonly sessions: number;
    readonly messages: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheCreationTokens: number;
    readonly cacheReadTokens: number;
    readonly costUsd: number;
    readonly durationMs: number;
  };
  readonly models: readonly StatsModelUsage[];
  readonly tools: readonly ToolUsage[];
  readonly activity: readonly DayActivity[];
  readonly topSessions: readonly SessionTokenTotals[];
}

interface Accumulator {
  usageRecorded: boolean;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  durationMs: number;
  models: Map<string, StatsModelUsage>;
  tools: Map<string, number>;
  days: Map<string, DayActivity>;
}

const sessionsForStats = async (
  agentDirs: readonly string[],
  projectId: string,
  agent: AgentId,
): Promise<readonly SessionSummary[]> => {
  const format = agentOption(agent).format;

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

const dayKeyOf = (entry: TurnEntry): string | undefined => {
  const day = entry.timestamp.slice(0, 10);

  return day.length === 10 ? day : undefined;
};

const addUsage = (accumulator: Accumulator, entry: HistoryEntry): void => {
  if (entry.kind !== 'assistant') {
    return;
  }

  accumulator.messages += 1;
  accumulator.usageRecorded ||= entry.usage != null
    || entry.costUsd != null
    || entry.durationMs != null;

  const usage = entry.usage ?? EMPTY_USAGE;

  accumulator.inputTokens += usage.inputTokens;
  accumulator.outputTokens += usage.outputTokens;
  accumulator.cacheCreationTokens += usage.cacheCreationTokens;
  accumulator.cacheReadTokens += usage.cacheReadTokens;
  accumulator.costUsd += entry.costUsd ?? 0;
  accumulator.durationMs += entry.durationMs ?? 0;

  const modelKey = entry.model ?? 'unknown';
  const model = accumulator.models.get(modelKey) ?? {
    model: modelKey,
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
  };

  accumulator.models.set(modelKey, {
    model: modelKey,
    requests: model.requests + 1,
    inputTokens: model.inputTokens + usage.inputTokens,
    outputTokens: model.outputTokens + usage.outputTokens,
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
  const tokens = totalTokens(usage);

  accumulator.days.set(day, {
    date: day,
    messages: existing.messages + 1,
    tokens: existing.tokens + (entry.kind === 'assistant' ? tokens : 0),
  });
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

  const accumulator: Accumulator = {
    usageRecorded: false,
    messages: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    costUsd: 0,
    durationMs: 0,
    models: new Map(),
    tools: new Map(),
    days: new Map(),
  };

  const perSession: SessionTokenTotals[] = [];

  for (const session of sessions) {
    const entries = await loadSessionEntriesOrEmpty(session.filePath, agent, agentDirs);

    let sessionMessages = 0;
    let sessionInput = 0;
    let sessionOutput = 0;
    let sessionCacheCreate = 0;
    let sessionCacheRead = 0;

    for (const entry of entries) {
      addUsage(accumulator, entry);
      addActivity(accumulator, entry);

      if (entry.kind === 'assistant') {
        sessionMessages += 1;
        const usage = entry.usage ?? EMPTY_USAGE;

        sessionInput += usage.inputTokens;
        sessionOutput += usage.outputTokens;
        sessionCacheCreate += usage.cacheCreationTokens;
        sessionCacheRead += usage.cacheReadTokens;
      }
    }

    perSession.push({
      filePath: session.filePath,
      sessionId: session.id,
      title: session.title ?? session.summary ?? session.preview,
      tokens: sessionInput + sessionOutput + sessionCacheCreate + sessionCacheRead,
      messages: sessionMessages,
      lastTimestampMs: session.lastTimestampMs,
    });
  }

  const topSessions = [...perSession].sort((left, right) => {
    return right.tokens - left.tokens || right.messages - left.messages;
  }).slice(0, 5);
  const activity = [...accumulator.days.values()].sort((left, right) => {
    return left.date.localeCompare(right.date);
  });

  return {
    projectId,
    totals: {
      usageRecorded: accumulator.usageRecorded,
      sessions: sessions.length,
      messages: accumulator.messages,
      inputTokens: accumulator.inputTokens,
      outputTokens: accumulator.outputTokens,
      cacheCreationTokens: accumulator.cacheCreationTokens,
      cacheReadTokens: accumulator.cacheReadTokens,
      costUsd: accumulator.costUsd,
      durationMs: accumulator.durationMs,
    },
    models: [...accumulator.models.values()].sort((left, right) => {
      return right.requests - left.requests;
    }),
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
