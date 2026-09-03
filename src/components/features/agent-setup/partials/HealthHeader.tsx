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
  readonly trust: ProjectTrust;
  readonly usage: ProjectUsage | null;
}

/**
 * The verdict, the counts, and the two facts that are states rather than
 * figures.
 *
 * These were four metric tiles, which repeated the set-up count already in the
 * verdict line and rendered trust as a word in a style meant for numbers. Trust
 * and findings are conditions, so they read as chips.
 */
export const HealthHeader: FC<HealthHeaderProps> = ({
  configured,
  total,
  flagged,
  findingCount,
  trust,
  usage,
}) => {
  const { t } = useTranslation('setup');
  const trusted = trust.known && trust.trusted;

  let trustLabel = t('trustUnknown');

  if (trust.known) {
    trustLabel = trust.trusted ? t('trustTrusted') : t('trustRestricted');
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
          {`${t('setUpCount', {
            configured,
            total,
          })} · ${usage == null
            ? t('spendNotRecorded')
            : t('spendRecorded', { cost: formatCost(usage.costUsd) })}`}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        <Badge tone={trusted ? 'neutral' : 'warn'}>
          {trusted
            ? <ShieldCheck className="size-3" />
            : <ShieldAlert className="size-3" />}
          {trustLabel}
        </Badge>
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
