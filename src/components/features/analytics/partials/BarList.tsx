import { useTranslation } from 'react-i18next';

import { formatTokens } from '@utils/formatUtils';

import { BarRow } from '@ui/index';

import { AnalyticsPanel } from './AnalyticsPanel';

import type { FC } from 'react';

export interface BarListProps {
  readonly title: string;
  readonly items: readonly { readonly label: string;
    readonly value: number; }[];
}

export const BarList: FC<BarListProps> = ({ title, items }) => {
  const { t } = useTranslation('common');
  const max = items.reduce((peak, item) => {
    return Math.max(peak, item.value);
  }, 0);

  return (
    <AnalyticsPanel title={title}>
      <ul className="mt-3 space-y-2" data-bar-list>
        {items.map((item) => {
          return (
            <BarRow
              key={item.label}
              label={item.label}
              value={item.value}
              max={max}
              formatValue={formatTokens}
            />
          );
        })}
        {items.length === 0 && <li className="text-xs text-muted-foreground">{t('nothingRecorded')}</li>}
      </ul>
    </AnalyticsPanel>
  );
};
