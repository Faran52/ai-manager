import { useTranslation } from 'react-i18next';

import { Panel } from '@ui/index';

import { usageItems } from '../utils/usageListUtils';

import { ActivityHeatmap } from './ActivityHeatmap';
import { BarList } from './BarList';
import { BillingBreakdown } from './BillingBreakdown';
import { ModelDistribution } from './ModelDistribution';
import { PricingCoverage } from './PricingCoverage';
import { ProjectUsageCard } from './ProjectUsageCard';
import { ProviderDistribution } from './ProviderDistribution';
import { ReportMetrics } from './ReportMetrics';
import { ReportSection } from './ReportSection';
import { StoragePanel } from './StoragePanel';
import { TopSessions } from './TopSessions';
import { WorkRhythm } from './WorkRhythm';

import type { AgentId } from '@config/agents';
import type { AsyncResource } from '@features/history-data';
import type { ProjectUsage } from '@services/agents/agentsService';
import type { SessionSummary } from '@services/history/historyService';
import type {
  AgentStatsUsage,
  ProjectStats,
  SessionTokenTotals,
} from '@services/stats/statsService';
import type { StorageReport } from '@services/storage/storageService';
import type { FC } from 'react';

export interface AnalyticsReportProps {
  readonly stats: ProjectStats;
  readonly storage: AsyncResource<StorageReport>;
  readonly globalAgents: readonly AgentStatsUsage[];
  readonly wholeMachine: boolean;
  // The one agent `stats` is already scoped to, when `wholeMachine` and a
  // report agent are both active.
  readonly reportAgent?: AgentId | undefined;
  readonly projectAgent?: AgentId | undefined;
  readonly sessions: readonly SessionSummary[];
  readonly onOpenSession: (session: SessionTokenTotals) => void;
  // What Claude Code itself recorded for this project, shown in the project
  // scope beside the figures this app derives from the transcripts.
  readonly usage?: ProjectUsage | null | undefined;
  readonly nowMs?: number | undefined;
}

export const AnalyticsReport: FC<AnalyticsReportProps> = ({
  stats: selectedStats,
  storage,
  globalAgents,
  wholeMachine,
  reportAgent,
  projectAgent,
  sessions,
  onOpenSession,
  usage,
  nowMs = 0,
}) => {
  const { t } = useTranslation('analytics');

  return (
    <div className="space-y-8 p-4">
      <ReportSection title={t('sectionOverview')} index={0}>
        <ReportMetrics stats={selectedStats} />
      </ReportSection>

      <ReportSection title={t('sectionCost')} index={1}>
        <div className="
          grid gap-4
          lg:grid-cols-2
        "
        >
          <BillingBreakdown totals={selectedStats.totals} />
          <PricingCoverage totals={selectedStats.totals} />
        </div>

        {!wholeMachine && usage != null && <ProjectUsageCard usage={usage} nowMs={nowMs} />}

        {/*
          * An agent's name, its session count and its share all sit on one
          * line, so the row needs the width: shared, the names were cut short.
          */}
        {wholeMachine && reportAgent == null && <ProviderDistribution agents={globalAgents} />}

        <ModelDistribution models={selectedStats.models} />
      </ReportSection>

      <ReportSection title={t('sectionActivity')} index={2}>
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
                <Panel title={t('activity')} className="flex h-full flex-col">
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t('tokenActivityMissing')}
                  </p>
                </Panel>
              )}
          <BarList
            title={t('toolCalls')}
            items={usageItems(selectedStats.tools)}
          />
          {selectedStats.skills.length > 0 && (
            <BarList
              title={t('skillCalls')}
              items={usageItems(selectedStats.skills)}
            />
          )}
          {selectedStats.subagents.length > 0 && (
            <BarList
              title={t('subagentCalls')}
              items={usageItems(selectedStats.subagents)}
            />
          )}
        </div>

        <WorkRhythm rhythm={selectedStats.rhythm} effort={selectedStats.effort} />
      </ReportSection>

      <ReportSection title={t('sectionStorage')} index={3}>
        <StoragePanel
          storage={storage}
          agent={wholeMachine ? reportAgent : projectAgent}
          projectSessions={wholeMachine ? undefined : sessions}
        />
      </ReportSection>

      {(!wholeMachine || reportAgent != null) && (
        <ReportSection title={t('sectionSessions')} index={4}>
          <TopSessions
            sessions={selectedStats.topSessions}
            usageRecorded={selectedStats.totals.usageRecorded}
            onOpenSession={onOpenSession}
          />
        </ReportSection>
      )}
    </div>
  );
};
