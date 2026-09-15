import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { ReportMetrics } from './ReportMetrics';

import type { ProjectStats } from '@services/stats/statsService';

const stats: ProjectStats = {
  projectId: 'p',
  totals: {
    usageRecorded: true,
    sessions: 3,
    messages: 12_000,
    inputTokens: 1_000,
    outputTokens: 2_000,
    cacheCreationTokens: 0,
    cacheReadTokens: 500,
    costUsd: 0.4,
    durationMs: 7_200_000,
  },
  models: [],
  tools: [],
  skills: [],
  subagents: [],
  activity: [],
  topSessions: [],
  rhythm: {
    hours: Array.from({ length: 24 }, () => {
      return 0;
    }),
    weekdays: [0, 0, 0, 0, 0, 0, 0],
    peakHour: undefined,
    activeDays: 0,
    spanDays: 0,
    currentStreak: 0,
    longestStreak: 0,
  },
  effort: {
    userMessages: 0,
    userChars: 0,
    userWords: 0,
    codeEdits: 0,
    commandsRun: 0,
    searches: 0,
    webActions: 0,
  },
};

test('derives a billing total from the token columns when none was recorded', () => {
  render(<ReportMetrics stats={stats} />);

  expect(screen.getByText('3')).toBeDefined();
  expect(screen.getByText('Billing total')).toBeDefined();
  expect(screen.getByText('3.5k')).toBeDefined();
  expect(screen.getByText('2.0h')).toBeDefined();
});

test('says so when the agent recorded no usage at all', () => {
  render(
    <ReportMetrics stats={{
      ...stats,
      totals: {
        ...stats.totals,
        usageRecorded: false,
      },
    }}
    />,
  );

  expect(screen.getAllByText('Not recorded')).toHaveLength(2);
});
