import { useTranslation } from 'react-i18next';

import { formatCost, formatTokens } from '@utils/formatUtils';

import { Badge, BarRow } from '@ui/index';

import { AnalyticsPanel } from './AnalyticsPanel';

import type { StatsModelUsage } from '@services/stats/statsService';
import type { FC } from 'react';

export interface ModelDistributionProps {
  readonly models: readonly StatsModelUsage[];
}

const toneFor = (basis: StatsModelUsage['basis']): 'neutral' | 'success' | 'warn' => {
  if (basis === 'exact') {
    return 'success';
  }

  return basis === 'estimated' ? 'warn' : 'neutral';
};

const labelKeyFor = (
  basis: StatsModelUsage['basis'],
): 'pricingBasisExact' | 'pricingBasisEstimated' | 'pricingBasisUnpriced' => {
  if (basis === 'exact') {
    return 'pricingBasisExact';
  }

  return basis === 'estimated' ? 'pricingBasisEstimated' : 'pricingBasisUnpriced';
};

export const ModelDistribution: FC<ModelDistributionProps> = ({ models }) => {
  const { t } = useTranslation('analytics');
  const ordered = [...models].sort((left, right) => {
    return (right.costUsd ?? -1) - (left.costUsd ?? -1)
      || right.inputTokens + right.outputTokens - left.inputTokens - left.outputTokens;
  });
  const max = ordered.reduce((peak, model) => {
    return Math.max(peak, model.inputTokens + model.outputTokens);
  }, 0);

  return (
    <AnalyticsPanel title={t('modelDistribution')}>
      <div className="mt-3 space-y-3" data-model-distribution>
        {ordered.map((model) => {
          const tokens = model.inputTokens + model.outputTokens;

          return (
            <div key={model.model}>
              <ul>
                <BarRow
                  label={model.model}
                  value={tokens}
                  max={max}
                  formatValue={formatTokens}
                />
              </ul>
              <div className="mt-1 flex items-center justify-end gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {model.costUsd == null ? t('costUnavailable') : formatCost(model.costUsd)}
                </span>
                <Badge tone={toneFor(model.basis)}>{t(labelKeyFor(model.basis))}</Badge>
              </div>
            </div>
          );
        })}
        {models.length === 0 && <p className="text-xs text-muted-foreground">{t('noModels')}</p>}
      </div>
    </AnalyticsPanel>
  );
};
