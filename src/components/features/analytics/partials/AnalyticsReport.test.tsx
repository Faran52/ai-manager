import { render, screen } from '@testing-library/react';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { AnalyticsReport } from './AnalyticsReport';

import type { AgentId } from '@config/agents';
import type { AsyncResource } from '@features/history-data';
import type { ProjectStats } from '@services/stats/statsService';
import type { StorageReport } from '@services/storage/storageService';

const STATS: ProjectStats = {
  projectId: 'p',
  totals: {
    usageRecorded: true,
    sessions: 3,
    messages: 12,
    inputTokens: 1_000,
    outputTokens: 2_000,
    cacheCreationTokens: 0,
    cacheReadTokens: 500,
    conversationTokens: 3_000,
    nonConversationTokens: 500,
    billingTokens: 3_500,
    splitUnavailable: false,
    pricingCoveragePercent: 100,
    unpricedModelCount: 0,
    costUsd: 0.4,
    durationMs: 7_200_000,
  },
  models: [{
    model: 'claude-sonnet-5',
    requests: 8,
    inputTokens: 2_000,
    outputTokens: 1_000,
    costUsd: 0.4,
    basis: 'exact',
  }],
  tools: [{
    tool: 'Bash',
    count: 9,
  }],
  skills: [{
    tool: 'code-review',
    count: 4,
  }],
  subagents: [{
    tool: 'Explore',
    count: 2,
  }],
  activity: [],
  topSessions: [{
    filePath: '/a.jsonl',
    sessionId: 'a',
    title: 'Big one',
    tokens: 900,
    messages: 5,
    lastTimestampMs: Date.UTC(2026, 0, 1),
    projectId: 'p',
    agent: 'claude',
  }],
  rhythm: {
    hours: Array.from({ length: 24 }, () => {
      return 1;
    }),
    weekdays: [9, 8, 7, 6, 5, 4, 3],
    peakHour: 14,
    activeDays: 12,
    spanDays: 20,
    currentStreak: 3,
    longestStreak: 6,
  },
  effort: {
    userMessages: 120,
    userChars: 6_000,
    userWords: 1_200,
    codeEdits: 40,
    commandsRun: 30,
    searches: 20,
    webActions: 10,
  },
};

const STORAGE: AsyncResource<StorageReport> = {
  status: 'ready',
  data: {
    agents: [
      {
        agent: 'claude',
        label: 'Claude Code',
        bytes: 100,
        entries: [],
        reclaimableBytes: 0,
      },
      {
        agent: 'codex',
        label: 'Codex CLI',
        bytes: 50,
        entries: [],
        reclaimableBytes: 0,
      },
    ],
    totalBytes: 150,
    reclaimableBytes: 0,
    partial: false,
  },
  reload: () => {
    return undefined;
  },
};

const report = (
  wholeMachine: boolean,
  stats: ProjectStats = STATS,
  reportAgent?: AgentId,
): ReturnType<typeof render> => {
  return render(
    <AnalyticsReport
      globalAgents={[{
        agent: 'claude',
        tokens: 3_500,
        sessions: 3,
        projects: 2,
      }]}
      onOpenSession={vi.fn()}
      sessions={[]}
      stats={stats}
      storage={STORAGE}
      wholeMachine={wholeMachine}
      reportAgent={reportAgent}
    />,
  );
};

describe('AnalyticsReport', () => {
  test('groups the report under named sections', () => {
    report(false);

    for (const title of ['Overview', 'Cost', 'Activity and effort', 'Storage', 'Sessions']) {
      expect(screen.getByRole('heading', { name: title })).toBeDefined();
    }
  });

  test('ranks sessions only when the scope is one project', () => {
    report(true);

    expect(screen.queryByRole('heading', { name: 'Sessions' })).toBeNull();
  });

  test('breaks usage out per agent only for the whole machine', () => {
    const { unmount } = report(true);

    expect(screen.getByText('claude-sonnet-5')).toBeDefined();
    unmount();
    report(false);

    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeDefined();
  });

  test('scopes the whole machine to one report agent', () => {
    report(true, STATS, 'claude');

    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeDefined();
    expect(screen.queryByText('Provider distribution')).toBeNull();
    expect(screen.getByText('Claude Code')).toBeDefined();
    expect(screen.queryByText('Codex CLI')).toBeNull();
  });

  test('says so instead of drawing a heatmap with nothing behind it', () => {
    report(false, {
      ...STATS,
      totals: {
        ...STATS.totals,
        usageRecorded: false,
      },
    });

    expect(screen.getByText(/Token activity isn/u)).toBeDefined();
  });

  test('leaves out skills and subagents the scope never used', () => {
    report(false, {
      ...STATS,
      skills: [],
      subagents: [],
    });

    expect(screen.queryByText('code-review')).toBeNull();
    expect(screen.queryByText('Explore')).toBeNull();
  });
});
