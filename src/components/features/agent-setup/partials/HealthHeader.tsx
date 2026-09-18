import { useTranslation } from 'react-i18next';

import {
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import { formatCost } from '@utils/formatUtils';

import { Badge } from '@ui/index';

import type { ProjectTrust, ProjectUsage } from '@services/agents/agentsService';
import type { FC } from 'react';

export interface HealthHeaderProps {
  readonly configured: number;
  readonly total: number;
  readonly flagged: number;
  readonly findingCount: number;
  // Absent with no project in scope: trust and spend are facts about one project.
  readonly trust?: ProjectTrust | undefined;
  readonly usage: ProjectUsage | null;
}

// Trust and findings are conditions, not figures, so they read as chips. As
// metric tiles they repeated the set-up count the verdict line already gives.
export const HealthHeader: FC<HealthHeaderProps> = ({
  configured,
  total,
  flagged,
  findingCount,
  trust,
  usage,
}) => {
  const { t } = useTranslation('setup');
  const trusted = trust?.known === true && trust.trusted;

  let trustLabel = t('trustUnknown');

  if (trust?.known === true) {
    trustLabel = trust.trusted ? t('trustTrusted') : t('trustRestricted');
  }

  const setUp = t('setUpCount', {
    configured,
    total,
  });
  let summary = setUp;

  if (trust != null) {
    const spend = usage == null
      ? t('spendNotRecorded')
      : t('spendRecorded', { cost: formatCost(usage.costUsd) });

    summary = `${setUp} · ${spend}`;
  }

  return (
    <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-1" data-health-header>
      <div className="min-w-0 flex-1">
        <h2 className={flagged === 0
          ? 'text-lg font-semibold'
          : 'text-lg font-semibold text-warn'}
        >
          {flagged === 0 ? t('healthy') : t('needsAttentionCount', { count: flagged })}
        </h2>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
          {summary}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        {trust != null && (
          <Badge tone={trusted ? 'neutral' : 'warn'}>
            {trusted
              ? <ShieldCheck className="size-3" />
              : <ShieldAlert className="size-3" />}
            {trustLabel}
          </Badge>
        )}
        {findingCount > 0 && (
          <Badge tone="warn">
            <TriangleAlert className="size-3" />
            {t('findingsCount', { count: findingCount })}
          </Badge>
        )}
      </span>
    </header>
  );
};
