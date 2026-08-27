import { useTranslation } from 'react-i18next';

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
  AnalyticsPanel,
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
  const { t } = useTranslation('analytics');
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
            ? t('tryRefreshing')
            : t('selectProjectWithSessions')}
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
          label={t('sessions', { ns: 'sidebar' })}
          value={String(stats.totals.sessions)}
          icon={(
            <MessagesSquare className="size-3.5" />
          )}
        />
        <MetricCard
          label={t('assistantTurns')}
          value={formatTokens(stats.totals.messages)}
          icon={(
            <Zap className="size-3.5" />
          )}
        />
        <MetricCard
          label={t('tokens')}
          value={stats.totals.usageRecorded ? formatTokens(totalTokens) : t('notRecorded', { ns: 'common' })}
          hint={stats.totals.usageRecorded
            ? `${formatTokens(stats.totals.cacheReadTokens)} cache reads`
            : undefined}
          icon={<Coins className="size-3.5" />}
        />
        <MetricCard
          label={t('computeTime')}
          value={stats.totals.usageRecorded
            ? formatDurationMs(stats.totals.durationMs)
            : t('notRecorded', { ns: 'common' })}
          hint={stats.totals.usageRecorded
            ? `${formatCost(stats.totals.costUsd)} recorded cost`
            : undefined}
        />
      </div>

      {stats.totals.usageRecorded
        ? <ActivityHeatmap activity={stats.activity} />
        : (
            <AnalyticsPanel title={t('activity')}>
              <p className="mt-3 text-sm text-muted-foreground">
                Token activity isn't recorded for this agent.
              </p>
            </AnalyticsPanel>
          )}

      <div className="
        grid gap-4
        lg:grid-cols-2
      "
      >
        <BarList
          title={t('models')}
          items={stats.models.map((model) => {
            return {
              label: model.model,
              value: model.requests,
            };
          })}
        />
        <BarList
          title={t('toolCalls')}
          items={stats.tools.slice(0, 10).map((tool) => {
            return {
              label: tool.tool,
              value: tool.count,
            };
          })}
        />
      </div>

      <TopSessions
        sessions={stats.topSessions}
        usageRecorded={stats.totals.usageRecorded}
        onOpenSession={onOpenSession}
      />

    </div>
  );
};
