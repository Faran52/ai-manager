import { useTranslation } from 'react-i18next';

import {
  BarChart3,
  CircleAlert,
  History,
} from 'lucide-react';

import {
  EmptyState,
  Loader,
  useMinLoad,
} from '@ui/index';

import { useGlobalStats } from './hooks/useGlobalStats';
import { AnalyticsReport } from './partials';

import type { AgentId } from '@config/agents';
import type {
  AsyncResource,
  AsyncStatus,
  ReportScope,
} from '@features/history-data';
import type { ProjectUsage } from '@services/agents/agentsService';
import type { SessionSummary } from '@services/history/historyService';
import type { ProjectStats, SessionTokenTotals } from '@services/stats/statsService';
import type { StorageReport } from '@services/storage/storageService';
import type { FC } from 'react';
import type { Scope } from './hooks/useAnalyticsScope';

export interface AnalyticsViewProps {
  readonly stats: ProjectStats | null | undefined;
  // What the agents hold on disk is global by nature, so it is shown whichever
  // scope the reader is in rather than switching with it.
  readonly storage: AsyncResource<StorageReport>;
  readonly status: AsyncStatus;
  readonly projectName: string;
  // Identifies the project rather than naming it, so that picking a different
  // one is noticed even where two projects share a name.
  readonly scope: Scope;
  readonly projectAgent?: AgentId | undefined;
  readonly onOpenSession: (session: SessionTokenTotals) => void;
  // Named in the report's own panels, so it stays even now the board has left.
  readonly sessions: readonly SessionSummary[];
  // The one agent (and profile) a global report is scoped to, from the All Projects card.
  readonly reportScope: ReportScope | null;
  // Claude Code's own recorded usage for the project, for the project scope.
  readonly usage?: ProjectUsage | null | undefined;
  readonly nowMs?: number | undefined;
}

export const AnalyticsView: FC<AnalyticsViewProps> = ({
  stats,
  storage,
  status,
  projectName,
  scope,
  projectAgent,
  onOpenSession,
  sessions,
  reportScope,
  usage,
  nowMs,
}) => {
  const global = useGlobalStats();
  const { t } = useTranslation('analytics');
  const effectiveScope = scope === 'global' && global.status !== 'error' ? 'global' : 'project';
  // A missing entry (still loading, or a stale selection) falls through to the
  // same empty state a `null` project's stats already show below.
  const globalStats = reportScope == null
    ? global.data
    : global.data?.perAgentProfile.find((entry) => {
        return entry.agent === reportScope.agent && entry.profile === reportScope.profile;
      });
  const selectedStats = effectiveScope === 'global' ? globalStats : stats;
  const selectedStatus = effectiveScope === 'global' ? global.status : status;
  const waiting = useMinLoad(selectedStatus === 'loading');
  const globalAgents = global.data?.agents ?? [];

  if (waiting) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center" data-analytics-loading>
          <Loader icon={<History />} label={t('loadingAnalytics')} />
        </div>
      </div>
    );
  }

  if (selectedStats == null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={selectedStatus === 'error' ? <CircleAlert /> : <BarChart3 />}
            tone={selectedStatus === 'error' ? 'error' : 'accent'}
            title={selectedStatus === 'error'
              ? t('loadFailedFor', { project: projectName })
              : t('noAnalyticsFor', { project: projectName })}
            hint={selectedStatus === 'error'
              ? t('tryRefreshing')
              : t('selectProjectWithSessions')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-analytics-view>
      <AnalyticsReport
        stats={selectedStats}
        storage={storage}
        globalAgents={globalAgents}
        wholeMachine={effectiveScope === 'global'}
        reportAgent={reportScope?.agent}
        projectAgent={projectAgent}
        sessions={sessions}
        onOpenSession={onOpenSession}
        usage={usage}
        nowMs={nowMs}
      />
    </div>
  );
};
