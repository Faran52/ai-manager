import { useTranslation } from 'react-i18next';

import { Coins } from 'lucide-react';

import {
  formatCost,
  formatDurationMs,
  formatTimeAgo,
  formatTokens,
} from '@utils/formatUtils';

import { BarRow, MetricCard } from '@ui/index';

import type { ProjectUsage } from '@services/agents/agentsService';
import type { FC } from 'react';

export interface ProjectUsageCardProps {
  readonly usage: ProjectUsage;
  readonly nowMs: number;
}

export const ProjectUsageCard: FC<ProjectUsageCardProps> = ({ usage, nowMs }) => {
  const { t, i18n } = useTranslation('analytics');
  const topModelCost = Math.max(0, ...usage.models.map((model) => {
    return model.costUsd;
  }));

  return (
    <section className="rounded-md border border-border bg-card p-2.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Coins className="size-4 text-muted-foreground" />
        {t('recordedUsage')}
        <span className="
          ms-auto font-mono text-xs font-normal text-muted-foreground
        "
        >
          {t('lastActive', { when: formatTimeAgo(usage.lastActiveMs, nowMs, i18n.language) })}
        </span>
      </h3>
      <div className="
        mt-2 grid grid-cols-2 gap-2
        sm:grid-cols-4
      "
      >
        <MetricCard label={t('spend')} value={formatCost(usage.costUsd)} />
        <MetricCard
          label={t('inOut')}
          value={`${formatTokens(usage.inputTokens)} / ${formatTokens(usage.outputTokens)}`}
        />
        <MetricCard label={t('cacheReads')} value={formatTokens(usage.cacheReadTokens)} />
        <MetricCard label={t('time')} value={formatDurationMs(usage.durationMs)} />
      </div>
      {usage.models.length > 0 && (
        <ul className="mt-2 grid gap-1 border-t border-border pt-2">
          {usage.models.map((model) => {
            return (
              <BarRow
                key={model.model}
                label={model.model}
                value={model.costUsd}
                max={topModelCost}
                formatValue={formatCost}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
};
