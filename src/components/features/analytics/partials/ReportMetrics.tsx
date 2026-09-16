import { useTranslation } from 'react-i18next';

import {
  Coins,
  MessagesSquare,
  Zap,
} from 'lucide-react';

import {
  formatCost,
  formatDurationMs,
  formatTokens,
} from '@utils/formatUtils';

import { MetricCard } from '@ui/index';

import type { ProjectStats } from '@services/stats/statsService';
import type { FC } from 'react';

export interface ReportMetricsProps {
  readonly stats: ProjectStats;
}

// The four headline tiles of a report: sessions, turns, billing and compute time.
export const ReportMetrics: FC<ReportMetricsProps> = ({ stats }) => {
  const { t } = useTranslation('analytics');
  const billingTokens = stats.totals.billingTokens
    ?? stats.totals.inputTokens
    + stats.totals.outputTokens
    + stats.totals.cacheCreationTokens
    + stats.totals.cacheReadTokens;

  return (
    <div className="
      grid grid-cols-2 gap-3
      xl:grid-cols-4
    "
    >
      <MetricCard
        label={t('sessions', { ns: 'sidebar' })}
        value={String(stats.totals.sessions)}
        icon={<MessagesSquare className="size-3.5" />}
      />
      <MetricCard
        label={t('assistantTurns')}
        value={formatTokens(stats.totals.messages)}
        icon={<Zap className="size-3.5" />}
      />
      <MetricCard
        label={t('billingTotal')}
        value={stats.totals.usageRecorded
          ? formatTokens(billingTokens)
          : t('notRecorded', { ns: 'common' })}
        hint={stats.totals.usageRecorded
          ? t('cacheReadsValue', { value: formatTokens(stats.totals.cacheReadTokens) })
          : undefined}
        icon={<Coins className="size-3.5" />}
      />
      <MetricCard
        label={t('computeTime')}
        value={stats.totals.usageRecorded && stats.totals.durationMs > 0
          ? formatDurationMs(stats.totals.durationMs)
          : t('notRecorded', { ns: 'common' })}
        hint={stats.totals.usageRecorded
          ? t('derivedCost', { value: formatCost(stats.totals.costUsd) })
          : undefined}
      />
    </div>
  );
};
