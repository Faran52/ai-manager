import { useTranslation } from 'react-i18next';

import { formatCost, formatTokens } from '@utils/formatUtils';

import { Badge, BarRow } from '@ui/index';

import { AnalyticsPanel } from './AnalyticsPanel';

import type { StatsModelUsage } from '@services/stats/statsService';
import type { PricingBasis } from '@services/stats/utils/pricingUtils';
import type { FC } from 'react';

export interface ModelDistributionProps {
  readonly models: readonly StatsModelUsage[];
}

/*
 * Every row states its own basis, because a cost read off a price sheet and a
 * cost inferred from what a provider billed are not the same claim. Keys, not
 * text: the map lives outside the component where t is unavailable.
 */
const BASIS_KEYS: Record<PricingBasis, string> = {
  exact: 'pricingBasisExact',
  estimated: 'pricingBasisEstimated',
  unpriced: 'pricingBasisUnpriced',
};

/*
 * Four columns rather than three: the tokens and the cost are two figures, and
 * a middot between them lines up only the second. Each gets a column of its
 * own, sized to its widest entry.
 */
const GRID = `
  mt-3 grid items-center gap-x-3 gap-y-2
  [grid-template-columns:minmax(0,max-content)_minmax(3.5rem,1fr)_max-content_max-content]
`;

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
      <ul className={GRID} data-model-distribution>
        {ordered.map((model, index) => {
          return (
            <BarRow
              index={index}
              key={model.model}
              label={model.model}
              max={max}
              value={model.inputTokens + model.outputTokens}
              formatValue={formatTokens}
              qualifier={(
                <Badge tone={model.basis === 'unpriced' ? 'warn' : 'neutral'}>
                  {/* One casing for all three, and a step smaller than the
                      figure beside it: a qualifier, not a second label. */}
                  <span className="text-eyebrow tracking-wider uppercase">
                    {t(BASIS_KEYS[model.basis])}
                  </span>
                </Badge>
              )}
              trailing={(
                <span className="
                  font-mono text-figure text-muted-foreground tabular-nums
                "
                >
                  {model.costUsd == null ? t('costUnavailable') : formatCost(model.costUsd)}
                </span>
              )}
            />
          );
        })}
        {models.length === 0 && (
          <li className="col-span-4 text-xs text-muted-foreground">{t('noModels')}</li>
        )}
      </ul>
    </AnalyticsPanel>
  );
};
