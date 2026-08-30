import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  beforeEach,
  expect,
  test,
  vi,
} from 'vitest';

import { AnalyticsView } from './AnalyticsView';

import type { GlobalStats, ProjectStats } from '@services/stats/statsService';

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
    conversationTokens: 3_000,
    nonConversationTokens: 500,
    billingTokens: 3_500,
    splitUnavailable: false,
    pricingCoveragePercent: 100,
    unpricedModelCount: 0,
    costUsd: 0.4,
    durationMs: 7_200_000,
  },
  models: [
    {
      model: 'claude-sonnet-5',
      requests: 8,
      inputTokens: 2_000,
      outputTokens: 1_000,
      costUsd: 0.4,
      basis: 'exact',
    },
    {
      model: 'gpt-5.5',
      requests: 2,
      inputTokens: 300,
      outputTokens: 200,
      basis: 'unpriced',
    },
  ],
  tools: [{
    tool: 'Bash',
    count: 9,
  }],
  activity: [],
  topSessions: [{
    filePath: '/a.jsonl',
    sessionId: 'a',
    title: 'Big one',
    tokens: 900,
    messages: 5,
    lastTimestampMs: Date.UTC(2026, 0, 1),
  }],
  rhythm: {
    hours: Array.from({ length: 24 }, (_unused, hour) => {
      return hour === 14 ? 40 : 1;
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

const globalStats: GlobalStats = {
  ...stats,
  projectId: 'global',
  totals: {
    ...stats.totals,
    conversationTokens: 3_000,
    nonConversationTokens: 500,
    billingTokens: 3_500,
    splitUnavailable: false,
    pricingCoveragePercent: 100,
    unpricedModelCount: 0,
  },
  agents: [{
    agent: 'claude',
    tokens: 3_500,
    sessions: 3,
    projects: 2,
  }],
};

const globalResponse = (): Response => {
  return new Response(JSON.stringify({ stats: globalStats }), { status: 200 });
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(globalResponse());
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderView = (
  projectStats: ProjectStats | null = stats,
  status: 'loading' | 'ready' | 'error' = 'ready',
  onOpenSession = vi.fn(),
  projectKey = 'claude:webapp',
) => {
  return render(
    <AnalyticsView
      stats={projectStats}
      status={status}
      projectName="webapp"
      projectKey={projectKey}
      onOpenSession={onOpenSession}
    />,
  );
};

const selectProject = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: 'Project: webapp' }));
};

test('shows the global report when no project has been chosen', async () => {
  renderView(stats, 'ready', vi.fn(), '');

  expect(await screen.findByText('Provider distribution')).toBeDefined();
  expect(screen.getByText('Claude Code · 3 sessions · 2 projects')).toBeDefined();
  expect(screen.queryByText('Big one')).toBeNull();

  await selectProject();
  await userEvent.click(screen.getByRole('button', { name: 'Global' }));

  expect(screen.getByText('Provider distribution')).toBeDefined();
});

test('opens on the project already chosen rather than on the global report', async () => {
  renderView();

  expect(await screen.findByText('Big one')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Project: webapp' }).getAttribute('aria-pressed'))
    .toBe('true');
});

test('shows project loading and empty states after changing scope', async () => {
  const view = renderView(null, 'loading');

  await selectProject();
  expect(screen.getByRole('status')).toBeDefined();

  view.rerender(
    <AnalyticsView
      stats={null}
      status="ready"
      projectName="webapp"
      projectKey="claude:webapp"
      onOpenSession={vi.fn()}
    />,
  );

  expect(screen.getByText(/No analytics for webapp/)).toBeDefined();
});

test('renders project metrics, panels and opens a top session', async () => {
  const onOpenSession = vi.fn();

  renderView(stats, 'ready', onOpenSession);
  await selectProject();

  expect(screen.getByText('12k')).toBeDefined();
  expect(screen.getAllByText('3.5k').length).toBeGreaterThan(0);
  expect(screen.getByText(/\$0\.40 derived cost/)).toBeDefined();
  expect(screen.getByText('claude-sonnet-5')).toBeDefined();
  expect(screen.getByText('Bash')).toBeDefined();
  expect(screen.getByText('Big one')).toBeDefined();
  expect(document.querySelector('[data-activity-heatmap]')).not.toBeNull();

  await userEvent.click(screen.getByText('Big one'));

  expect(onOpenSession).toHaveBeenCalledWith(stats.topSessions[0]);
});

test('renders project analytics without ranked sessions', async () => {
  renderView({
    ...stats,
    topSessions: [],
  });
  await selectProject();

  expect(document.querySelector('[data-top-sessions]')).not.toBeNull();
});

test('labels project metrics without recorded usage', async () => {
  renderView({
    ...stats,
    totals: {
      ...stats.totals,
      usageRecorded: false,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      conversationTokens: 0,
      nonConversationTokens: 0,
      billingTokens: 0,
      costUsd: 0,
      durationMs: 0,
    },
  });
  await selectProject();

  expect(screen.getAllByText('Not recorded')).toHaveLength(2);
  expect(screen.getByText("Token activity isn't recorded for this agent.")).toBeDefined();
  expect(document.querySelector('[data-activity-heatmap]')).toBeNull();
});

test('derives a project billing total from a legacy payload', async () => {
  renderView({
    ...stats,
    totals: {
      ...stats.totals,
      billingTokens: undefined,
    },
  });
  await selectProject();

  expect(screen.getAllByText('3.5k').length).toBeGreaterThan(0);
});

test('shows the session id when a ranked session has no title', async () => {
  renderView({
    ...stats,
    topSessions: [{
      filePath: '/z.jsonl',
      sessionId: 'zzz',
      title: undefined,
      tokens: 1,
      messages: 1,
      lastTimestampMs: 0,
    }],
  });
  await selectProject();

  expect(screen.getByText('zzz')).toBeDefined();
});

test('shows a project error state', async () => {
  renderView(null, 'error');
  await selectProject();

  expect(screen.getByText("Couldn't load analytics for webapp")).toBeDefined();
  expect(screen.getByText('Try refreshing from the header.')).toBeDefined();
});

test('shows a global error for failed and malformed responses', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response('{}', { status: 500 }));
  }));
  const view = renderView(null, 'error');

  expect(await screen.findByText("Couldn't load analytics for webapp")).toBeDefined();
  view.unmount();

  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response('{}', { status: 200 }));
  }));
  renderView(null, 'error');

  expect(await screen.findByText("Couldn't load analytics for webapp")).toBeDefined();
});

test('does not update global state after unmounting', async () => {
  const pending = Promise.withResolvers<Response>();

  vi.stubGlobal('fetch', vi.fn(() => {
    return pending.promise;
  }));
  const view = renderView();

  view.unmount();
  pending.resolve(globalResponse());
  await pending.promise;

  expect(document.querySelector('[data-analytics-view]')).toBeNull();
});

test('does not report a request error after unmounting', async () => {
  const pending = Promise.withResolvers<Response>();

  vi.stubGlobal('fetch', vi.fn(() => {
    return pending.promise;
  }));
  const view = renderView();

  view.unmount();
  pending.reject(new Error('offline'));

  await expect(pending.promise).rejects.toThrow('offline');
  expect(document.querySelector('[data-analytics-view]')).toBeNull();
});

test('follows the project that was chosen instead of staying on the global report', async () => {
  const view = renderView(stats, 'ready', vi.fn(), '');

  expect(await screen.findByText('Provider distribution')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Global' }).getAttribute('aria-pressed')).toBe('true');

  view.rerender(
    <AnalyticsView
      stats={stats}
      status="ready"
      projectName="webapp"
      projectKey="claude:webapp"
      onOpenSession={vi.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'Project: webapp' }).getAttribute('aria-pressed'))
    .toBe('true');
  expect(screen.getByText('Big one')).toBeDefined();
});

test('leaves the reader on the global report when they asked for it', async () => {
  const view = renderView(stats, 'ready', vi.fn(), 'claude:webapp');

  await userEvent.click(await screen.findByRole('button', { name: 'Global' }));

  view.rerender(
    <AnalyticsView
      stats={stats}
      status="ready"
      projectName="webapp"
      projectKey="claude:webapp"
      onOpenSession={vi.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'Global' }).getAttribute('aria-pressed')).toBe('true');
});
