import { useTranslation } from 'react-i18next';

import { maxOf } from '@utils/arrayUtils';
import { formatCost, formatTokens } from '@utils/formatUtils';

import {
  Badge,
  BarRow,
  Panel,
} from '@ui/index';

import type { StatsModelUsage } from '@services/stats/statsService';
import type { PricingBasis } from '@services/stats/utils/pricingUtils';
import type { FC } from 'react';

export interface ModelDistributionProps {
  readonly models: readonly StatsModelUsage[];
}

/*
 * Every row states its own basis: a price-sheet cost and a billed cost are not the
 * same claim. Keys, not text, since the map lives outside the component.
 */
const BASIS_KEYS: Record<PricingBasis, string> = {
  exact: 'pricingBasisExact',
  estimated: 'pricingBasisEstimated',
  unpriced: 'pricingBasisUnpriced',
};

/*
 * Four columns rather than three: tokens and cost are two figures, and a middot
 * between them lines up only the second.
 */
const GRID = `
  mt-3 grid items-center gap-x-3 gap-y-2
  [grid-template-columns:minmax(0,max-content)_minmax(3.5rem,1fr)_max-content_max-content]
`;

export const ModelDistribution: FC<ModelDistributionProps> = ({ models }) => {
  const { t } = useTranslation('analytics');
  // The service already orders by cost, then tokens. A model with no tokens is a
  // synthetic placeholder and has nothing to show.
  const shown = models.filter((model) => {
    return model.inputTokens + model.outputTokens > 0;
  });
  const max = maxOf(shown, (model) => {
    return model.inputTokens + model.outputTokens;
  });

  return (
    <Panel title={t('modelDistribution')} className="flex h-full flex-col">
      <ul className={GRID} data-model-distribution>
        {shown.map((model, index) => {
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
                  {model.costUsd == null ? null : formatCost(model.costUsd)}
                </span>
              )}
            />
          );
        })}
        {shown.length === 0 && (
          <li className="col-span-4 text-xs text-muted-foreground">{t('noModels')}</li>
        )}
      </ul>
    </Panel>
  );
};
