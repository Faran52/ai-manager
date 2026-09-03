import { useTranslation } from 'react-i18next';

import {
  Blocks,
  Coins,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import { formatCost } from '@utils/formatUtils';

import { MetricCard } from '@ui/index';

import type { ProjectTrust, ProjectUsage } from '@services/agents/agentsService';
import type { FC } from 'react';

export interface HealthSummaryProps {
  readonly configured: number;
  readonly total: number;
  readonly findingCount: number;
  readonly trust: ProjectTrust;
  readonly usage: ProjectUsage | null;
}

const ICON = 'size-3.5';

/**
 * The four facts worth knowing before reading the agent list.
 *
 * These were three stacked cards, each with its own box and heading, so the
 * list they introduced started a screen down. One strip of figures says the
 * same and leaves the list below as only the list.
 */
export const HealthSummary: FC<HealthSummaryProps> = ({
  configured,
  total,
  findingCount,
  trust,
  usage,
}) => {
  const { t } = useTranslation('setup');

  let trustLabel = t('trustUnknown');

  if (trust.known) {
    trustLabel = trust.trusted ? t('trustTrusted') : t('trustRestricted');
  }

  return (
    <div
      className="
        grid grid-cols-2 gap-2
        sm:grid-cols-4
      "
      data-health-summary
    >
      <MetricCard
        icon={<Blocks className={ICON} />}
        label={t('summaryAgents')}
        value={`${String(configured)}/${String(total)}`}
      />
      <MetricCard
        icon={<Coins className={ICON} />}
        label={t('summarySpend')}
        value={usage == null ? '—' : formatCost(usage.costUsd)}
        hint={usage == null ? t('notRecorded', { ns: 'common' }) : undefined}
      />
      <MetricCard
        icon={<ShieldCheck className={ICON} />}
        label={t('summaryTrust')}
        value={trustLabel}
      />
      <MetricCard
        icon={<TriangleAlert className={ICON} />}
        label={t('summaryFindings')}
        value={String(findingCount)}
      />
    </div>
  );
};
