import { useTranslation } from 'react-i18next';

import { formatTokens } from '@utils/formatUtils';

import { MetricCard } from '@ui/index';

import { AnalyticsPanel } from './AnalyticsPanel';

import type { StatsTotals } from '@services/stats/statsService';
import type { FC } from 'react';

export interface BillingBreakdownProps {
  readonly totals: StatsTotals;
}

const shareOf = (tokens: number, billingTokens: number): string => {
  const percentage = billingTokens === 0 ? 0 : Math.round((tokens / billingTokens) * 100);

  return `${String(percentage)}%`;
};

export const BillingBreakdown: FC<BillingBreakdownProps> = ({ totals }) => {
  const { t } = useTranslation('analytics');
  const conversationTokens = totals.conversationTokens ?? totals.inputTokens + totals.outputTokens;
  const nonConversationTokens = totals.nonConversationTokens
    ?? totals.cacheCreationTokens + totals.cacheReadTokens;
  const billingTokens = totals.billingTokens ?? conversationTokens + nonConversationTokens;

  return (
    <AnalyticsPanel title={t('billingBreakdown')}>
      <div className="
        mt-3 grid gap-3
        md:grid-cols-3
      "
      >
        <MetricCard
          label={t('conversationTokens')}
          value={formatTokens(conversationTokens)}
          hint={t('billingShare', { share: shareOf(conversationTokens, billingTokens) })}
        />
        <MetricCard
          label={t('nonConversationTokens')}
          value={formatTokens(nonConversationTokens)}
          hint={t('billingShare', { share: shareOf(nonConversationTokens, billingTokens) })}
        />
        <MetricCard
          label={t('billingTotal')}
          value={formatTokens(billingTokens)}
          hint={t('billingShare', { share: shareOf(billingTokens, billingTokens) })}
        />
      </div>
      {totals.splitUnavailable && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('splitUnavailable')}
        </p>
      )}
    </AnalyticsPanel>
  );
};
