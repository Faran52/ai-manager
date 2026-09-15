import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BarChart3, CircleAlert } from 'lucide-react';

import { EmptyState, Spinner } from '@ui/index';

import { AnalyticsReport } from './partials';

import type { AgentId } from '@config/agents';
import type { AsyncResource, ReportScope } from '@features/history-data';
import type { ProjectUsage } from '@services/agents/agentsService';
import type { SessionSummary } from '@services/history/historyService';
import type {
  GlobalStats,
  ProjectStats,
  SessionTokenTotals,
} from '@services/stats/statsService';
import type { StorageReport } from '@services/storage/storageService';
import type { FC } from 'react';
import type { Scope } from './hooks/useAnalyticsScope';

type LoadState = 'loading' | 'ready' | 'error';

export interface AnalyticsViewProps {
  readonly stats: ProjectStats | null | undefined;
  // What the agents hold on disk is global by nature, so it is shown whichever
  // scope the reader is in rather than switching with it.
  readonly storage: AsyncResource<StorageReport>;
  readonly status: LoadState;
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

interface GlobalStatsResponse {
  readonly stats: GlobalStats;
}

interface GlobalSnapshot {
  readonly data?: GlobalStats | undefined;
  readonly status: LoadState;
}

const isGlobalStatsResponse = (value: unknown): value is GlobalStatsResponse => {
  return typeof value === 'object'
    && value !== null
    && 'stats' in value
    && typeof value.stats === 'object'
    && value.stats !== null
    && 'agents' in value.stats
    && Array.isArray(value.stats.agents);
};

const useGlobalStats = (): GlobalSnapshot => {
  const [global, setGlobal] = useState<GlobalSnapshot>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch('/api/global-stats', { signal: controller.signal });
        const parsed: unknown = JSON.parse(await response.text());

        if (!response.ok || !isGlobalStatsResponse(parsed)) {
          throw new Error('Invalid global stats response');
        }

        if (!controller.signal.aborted) {
          setGlobal({
            data: parsed.stats,
            status: 'ready',
          });
        }
      }
      catch {
        if (!controller.signal.aborted) {
          setGlobal({ status: 'error' });
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  return global;
};

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
  const globalAgents = global.data?.agents ?? [];

  if (selectedStatus === 'loading') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center" data-analytics-loading>
          <Spinner />
        </div>
      </div>
    );
  }

  if (selectedStats == null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={selectedStatus === 'error'
              ? <CircleAlert className="size-10" />
              : <BarChart3 className="size-10" />}
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
