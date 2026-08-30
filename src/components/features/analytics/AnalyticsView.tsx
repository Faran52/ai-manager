import { useEffect, useState } from 'react';
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
  Button,
  EmptyState,
  MetricCard,
  Spinner,
} from '@ui/index';

import {
  ActivityHeatmap,
  AnalyticsPanel,
  BarList,
  BillingBreakdown,
  ModelDistribution,
  PricingCoverage,
  ProviderDistribution,
  StoragePanel,
  TopSessions,
  WorkRhythm,
} from './partials';

import type { AsyncResource } from '@features/history-data';
import type {
  GlobalStats,
  ProjectStats,
  SessionTokenTotals,
} from '@services/stats/statsService';
import type { StorageReport } from '@services/storage/storageService';
import type { FC, ReactNode } from 'react';

export interface AnalyticsViewProps {
  readonly stats: ProjectStats | null | undefined;
  // What the agents hold on disk is global by nature, so it is shown whichever
  // scope the reader is in rather than switching with it.
  readonly storage: AsyncResource<StorageReport>;
  readonly status: 'loading' | 'ready' | 'error';
  readonly projectName: string;
  // Identifies the project rather than naming it, so that picking a different
  // one is noticed even where two projects share a name.
  readonly projectKey: string;
  readonly onOpenSession: (session: SessionTokenTotals) => void;
}

interface GlobalStatsResponse {
  readonly stats: GlobalStats;
}

interface GlobalSnapshot {
  readonly data?: GlobalStats | undefined;
  readonly status: 'loading' | 'ready' | 'error';
}

type Scope = 'global' | 'project';

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

const scopeFor = (projectKey: string): Scope => {
  return projectKey.length > 0 ? 'project' : 'global';
};

/**
 * A chosen project is a request to see that project, both on arriving here and
 * on choosing a different one afterwards. Left to itself the view stayed on the
 * global report and only the scope button's label changed, which reads as the
 * analytics ignoring the choice. Asking for the global report still holds until
 * the project changes again.
 */
const useAnalyticsScope = (projectKey: string): {
  readonly scope: Scope;
  readonly setScope: (next: Scope) => void;
} => {
  const [scope, setScope] = useState<Scope>(() => {
    return scopeFor(projectKey);
  });
  const [shownProject, setShownProject] = useState(projectKey);

  if (projectKey !== shownProject) {
    setShownProject(projectKey);
    setScope(scopeFor(projectKey));
  }

  return {
    scope,
    setScope,
  };
};

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

export const AnalyticsView: FC<AnalyticsViewProps> = ({
  stats,
  storage,
  status,
  projectName,
  projectKey,
  onOpenSession,
}) => {
  const { scope, setScope } = useAnalyticsScope(projectKey);
  const global = useGlobalStats();
  const { t } = useTranslation('analytics');
  const effectiveScope = scope === 'global' && global.status !== 'error' ? 'global' : 'project';
  const selectedStats = effectiveScope === 'global' ? global.data : stats;
  const selectedStatus = effectiveScope === 'global' ? global.status : status;
  const globalAgents = global.data?.agents ?? [];

  const scopeSwitch = (
    <div className="flex items-center justify-end gap-1 px-4 pt-4" aria-label={t('analyticsScope')}>
      <Button
        size="sm"
        variant={effectiveScope === 'global' ? 'primary' : 'ghost'}
        pressed={effectiveScope === 'global'}
        onClick={() => {
          setScope('global');
        }}
      >
        {t('globalScope')}
      </Button>
      <Button
        size="sm"
        variant={effectiveScope === 'project' ? 'primary' : 'ghost'}
        pressed={effectiveScope === 'project'}
        onClick={() => {
          setScope('project');
        }}
      >
        {t('projectScope', { project: projectName })}
      </Button>
    </div>
  );

  if (selectedStatus === 'loading') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {scopeSwitch}
        <div className="flex flex-1 items-center justify-center" data-analytics-loading>
          <Spinner />
        </div>
      </div>
    );
  }

  if (selectedStats == null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {scopeSwitch}
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
      {scopeSwitch}
      <div className="space-y-4 p-4">
        {metricsFor(selectedStats, t)}

        <BillingBreakdown totals={selectedStats.totals} />

        <div className="
          grid gap-4
          lg:grid-cols-2
        "
        >
          <PricingCoverage totals={selectedStats.totals} />
          {effectiveScope === 'global' && (
            <ProviderDistribution agents={globalAgents} />
          )}
        </div>

        {selectedStats.totals.usageRecorded
          ? <ActivityHeatmap activity={selectedStats.activity} />
          : (
              <AnalyticsPanel title={t('activity')}>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t('tokenActivityMissing')}
                </p>
              </AnalyticsPanel>
            )}

        <div className="
          grid gap-4
          lg:grid-cols-2
        "
        >
          <ModelDistribution models={selectedStats.models} />
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

        <StoragePanel storage={storage} />

        {effectiveScope === 'project' && (
          <TopSessions
            sessions={selectedStats.topSessions}
            usageRecorded={selectedStats.totals.usageRecorded}
            onOpenSession={onOpenSession}
          />
        )}
      </div>
    </div>
  );
};
