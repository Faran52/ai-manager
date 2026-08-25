import {
  BarChart3,
  CircleAlert,
  Coins,
  MessagesSquare,
  Zap,
} from 'lucide-react';

import {
  formatCost,
  formatDurationMs,
  formatTokens,
} from '@utils/formatUtils';

import {
  EmptyState,
  MetricCard,
  Spinner,
} from '@ui/index';

import {
  ActivityHeatmap,
  BarList,
  TopSessions,
} from './partials';

import type { ProjectStats, SessionTokenTotals } from '@services/stats/statsService';
import type { FC } from 'react';

export interface AnalyticsViewProps {
  readonly stats: ProjectStats | null | undefined;
  readonly status: 'loading' | 'ready' | 'error';
  readonly projectName: string;
  readonly onOpenSession: (session: SessionTokenTotals) => void;
}

export const AnalyticsView: FC<AnalyticsViewProps> = ({
  stats,
  status,
  projectName,
  onOpenSession,
}) => {
  if (status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center" data-analytics-loading>
        <Spinner />
      </div>
    );
  }

  if (stats == null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={status === 'error'
            ? <CircleAlert className="size-10" />
            : <BarChart3 className="size-10" />}
          title={status === 'error'
            ? `Couldn't load analytics for ${projectName}`
            : `No analytics for ${projectName}`}
          hint={status === 'error'
            ? 'Try refreshing from the header.'
            : 'Select a project with recorded sessions.'}
        />
      </div>
    );
  }

  const totalTokens = stats.totals.inputTokens + stats.totals.outputTokens;

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" data-analytics-view>
      <div className="
        grid grid-cols-2 gap-3
        xl:grid-cols-4
      "
      >
        <MetricCard
          label="Sessions"
          value={String(stats.totals.sessions)}
          icon={(
            <MessagesSquare className="size-3.5" />
          )}
        />
        <MetricCard
          label="Assistant turns"
          value={formatTokens(stats.totals.messages)}
          icon={(
            <Zap className="size-3.5" />
          )}
        />
        <MetricCard
          label="Tokens"
          value={formatTokens(totalTokens)}
          hint={`${formatTokens(stats.totals.cacheReadTokens)} cache reads`}
          icon={<Coins className="size-3.5" />}
        />
        <MetricCard
          label="Compute time"
          value={formatDurationMs(stats.totals.durationMs)}
          hint={`${formatCost(stats.totals.costUsd)} recorded cost`}
        />
      </div>

      <ActivityHeatmap activity={stats.activity} />

      <div className="
        grid gap-4
        lg:grid-cols-2
      "
      >
        <BarList
          title="Models by requests"
          items={stats.models.map((model) => {
            return {
              label: model.model,
              value: model.requests,
            };
          })}
        />
        <BarList
          title="Tool calls"
          items={stats.tools.slice(0, 10).map((tool) => {
            return {
              label: tool.tool,
              value: tool.count,
            };
          })}
        />
      </div>

      <TopSessions sessions={stats.topSessions} onOpenSession={onOpenSession} />

    </div>
  );
};
