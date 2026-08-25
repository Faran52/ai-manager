import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { AnalyticsView } from './AnalyticsView';

import type { ProjectStats } from '@services/stats/statsService';

const stats: ProjectStats = {
  projectId: 'p',
  totals: {
    sessions: 3,
    messages: 12_000,
    inputTokens: 1_000,
    outputTokens: 2_000,
    cacheCreationTokens: 0,
    cacheReadTokens: 500,
    costUsd: 0.4,
    durationMs: 7_200_000,
  },
  models: [
    {
      model: 'claude-sonnet-5',
      requests: 8,
      inputTokens: 0,
      outputTokens: 0,
    },
    {
      model: 'gpt-5.5',
      requests: 2,
      inputTokens: 0,
      outputTokens: 0,
    },
  ],
  tools: [{
    tool: 'Bash',
    count: 9,
  }],
  activity: [],
  topSessions: [
    {
      filePath: '/a.jsonl',
      sessionId: 'a',
      title: 'Big one',
      tokens: 900,
      messages: 5,
      lastTimestampMs:
  Date.UTC(2026, 0, 1),
    },
  ],
};

describe('AnalyticsView', () => {
  test('shows loading and empty states', () => {
    const { rerender } = render(
      <AnalyticsView
        stats={null}
        status="loading"
        projectName="webapp"
        onOpenSession={() => {
          return undefined;
        }}
      />,
    );

    expect(screen.getByRole('status')).toBeDefined();

    rerender(
      <AnalyticsView
        stats={null}
        status="ready"
        projectName="webapp"
        onOpenSession={() => {
          return undefined;
        }}
      />,
    );

    expect(screen.getByText(/No analytics for webapp/)).toBeDefined();
  });

  test('renders metrics, charts and opens a top session', async () => {
    const onOpenSession = vi.fn();

    render(
      <AnalyticsView stats={stats} status="ready" projectName="webapp" onOpenSession={onOpenSession} />,
    );

    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('12k')).toBeDefined();
    expect(screen.getByText('3.0k')).toBeDefined();
    expect(screen.getByText(/\$0\.40 recorded cost/)).toBeDefined();
    expect(screen.getByText('claude-sonnet-5')).toBeDefined();
    expect(screen.getByText('Bash')).toBeDefined();
    expect(screen.getByText('Big one')).toBeDefined();
    expect(document.querySelector('[data-activity-heatmap]')).not.toBeNull();

    await userEvent.click(screen.getByText('Big one'));

    expect(onOpenSession).toHaveBeenCalledWith(stats.topSessions[0]);
  });
});

describe('AnalyticsView without ranked sessions', () => {
  test('renders the section even when nothing is ranked', () => {
    render(
      <AnalyticsView
        stats={{
          ...stats,
          topSessions: [],
        }}
        status="ready"
        projectName="webapp"
        onOpenSession={() => {
          return undefined;
        }}
      />,
    );

    expect(document.querySelector('[data-top-sessions]')).not.toBeNull();
  });
});

describe('TopSessions fallback title', () => {
  test('shows the session id when no title exists', () => {
    const onOpenSession = vi.fn();

    render(
      <AnalyticsView
        stats={{
          ...stats,
          topSessions: [
            {
              filePath: '/z.jsonl',
              sessionId: 'zzz',
              title: undefined,
              tokens: 1,
              messages: 1,
              lastTimestampMs: 0,
            },
          ],
        }}
        status="ready"
        projectName="webapp"
        onOpenSession={onOpenSession}
      />,
    );

    expect(screen.getByText('zzz')).toBeDefined();
  });
});

describe('AnalyticsView error state', () => {
  test('shows an error empty state instead of the no-data message', () => {
    render(
      <AnalyticsView stats={null} status="error" projectName="webapp" onOpenSession={vi.fn()} />,
    );

    expect(screen.getByText("Couldn't load analytics for webapp")).toBeDefined();
    expect(screen.getByText('Try refreshing from the header.')).toBeDefined();
  });
});
