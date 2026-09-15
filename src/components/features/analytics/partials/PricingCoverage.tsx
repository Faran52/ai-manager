import { useTranslation } from 'react-i18next';

import { MetricCard, Panel } from '@ui/index';

import type { StatsTotals } from '@services/stats/statsService';
import type { FC } from 'react';

export interface PricingCoverageProps {
  readonly totals: StatsTotals;
}

export const PricingCoverage: FC<PricingCoverageProps> = ({ totals }) => {
  const { t } = useTranslation('analytics');

  return (
    <Panel title={t('pricingCoverage')} className="flex h-full flex-col">
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MetricCard
          label={t('pricedTokens')}
          value={`${(totals.pricingCoveragePercent ?? 0).toFixed(1)}%`}
        />
        <MetricCard
          label={t('unpricedModels')}
          value={String(totals.unpricedModelCount ?? 0)}
        />
      </div>
    </Panel>
  );
};
