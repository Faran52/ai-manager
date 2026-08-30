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

import { ActivityHeatmap } from './ActivityHeatmap';
import { AnalyticsPanel } from './AnalyticsPanel';
import { BarList } from './BarList';
import { BillingBreakdown } from './BillingBreakdown';
import { ModelDistribution } from './ModelDistribution';
import { PricingCoverage } from './PricingCoverage';
import { ProviderDistribution } from './ProviderDistribution';
import { StoragePanel } from './StoragePanel';
import { TopSessions } from './TopSessions';
import { WorkRhythm } from './WorkRhythm';

import type { AgentId } from '@config/agents';
import type { AsyncResource } from '@features/history-data';
import type { SessionSummary } from '@services/history/historyService';
import type {
  AgentStatsUsage,
  ProjectStats,
  SessionTokenTotals,
} from '@services/stats/statsService';
import type { StorageReport } from '@services/storage/storageService';
import type { FC, ReactNode } from 'react';

export interface AnalyticsReportProps {
  readonly stats: ProjectStats;
  readonly storage: AsyncResource<StorageReport>;
  readonly globalAgents: readonly AgentStatsUsage[];
  readonly wholeMachine: boolean;
  readonly projectAgent?: AgentId | undefined;
  readonly sessions: readonly SessionSummary[];
  readonly onOpenSession: (session: SessionTokenTotals) => void;
}

const metricsFor = (
  stats: ProjectStats,
  translate: ReturnType<typeof useTranslation>['t'],
): ReactNode => {
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
        label={translate('sessions', { ns: 'sidebar' })}
        value={String(stats.totals.sessions)}
        icon={<MessagesSquare className="size-3.5" />}
      />
      <MetricCard
        label={translate('assistantTurns')}
        value={formatTokens(stats.totals.messages)}
        icon={<Zap className="size-3.5" />}
      />
      <MetricCard
        label={translate('billingTotal')}
        value={stats.totals.usageRecorded
          ? formatTokens(billingTokens)
          : translate('notRecorded', { ns: 'common' })}
        hint={stats.totals.usageRecorded
          ? translate('cacheReadsValue', { value: formatTokens(stats.totals.cacheReadTokens) })
          : undefined}
        icon={<Coins className="size-3.5" />}
      />
      <MetricCard
        label={translate('computeTime')}
        value={stats.totals.usageRecorded
          ? formatDurationMs(stats.totals.durationMs)
          : translate('notRecorded', { ns: 'common' })}
        hint={stats.totals.usageRecorded
          ? translate('derivedCost', { value: formatCost(stats.totals.costUsd) })
          : undefined}
      />
    </div>
  );
};

/*
 * A named group of panels. Without them the report was one long column of cards
 * with nothing to say where one subject ended and the next began.
 */
const Section: FC<{ readonly title: string;
  readonly children: ReactNode; }> = ({ title, children }) => {
  return (
    <section className="grid gap-4">
      <h3 className="
        text-xs font-semibold tracking-wider text-foreground/80 uppercase
      "
      >
        {title}
      </h3>
      {children}
    </section>
  );
};

export const AnalyticsReport: FC<AnalyticsReportProps> = ({
  stats: selectedStats,
  storage,
  globalAgents,
  wholeMachine,
  projectAgent,
  sessions,
  onOpenSession,
}) => {
  const { t } = useTranslation('analytics');

  return (
    <div className="space-y-8 p-4">
      <Section title={t('sectionOverview')}>
        {metricsFor(selectedStats, t)}
      </Section>

      <Section title={t('sectionCost')}>
        <div className="
          grid gap-4
          lg:grid-cols-2
        "
        >
          <BillingBreakdown totals={selectedStats.totals} />
          <PricingCoverage totals={selectedStats.totals} />
          {wholeMachine && (
            <ProviderDistribution agents={globalAgents} />
          )}
        </div>

        <ModelDistribution models={selectedStats.models} />
      </Section>

      <Section title={t('sectionActivity')}>
        {/*
          * The grid of days is narrow by nature, so it shares its row rather
          * than leaving half the width empty.
          */}
        <div className="
          grid gap-4
          lg:grid-cols-2
        "
        >
          {selectedStats.totals.usageRecorded
            ? <ActivityHeatmap activity={selectedStats.activity} />
            : (
                <AnalyticsPanel title={t('activity')}>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t('tokenActivityMissing')}
                  </p>
                </AnalyticsPanel>
              )}
          <BarList
            title={t('toolCalls')}
            items={selectedStats.tools.slice(0, 10).map((tool) => {
              return {
                label: tool.tool,
                value: tool.count,
              };
            })}
          />
        </div>

        <WorkRhythm rhythm={selectedStats.rhythm} effort={selectedStats.effort} />
      </Section>

      <Section title={t('sectionStorage')}>
        <StoragePanel
          storage={storage}
          agent={wholeMachine ? undefined : projectAgent}
          projectSessions={wholeMachine ? undefined : sessions}
        />
      </Section>

      {!wholeMachine && (
        <Section title={t('sectionSessions')}>
          <TopSessions
            sessions={selectedStats.topSessions}
            usageRecorded={selectedStats.totals.usageRecorded}
            onOpenSession={onOpenSession}
          />
        </Section>
      )}
    </div>
  );
};
