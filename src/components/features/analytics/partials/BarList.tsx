import { useTranslation } from 'react-i18next';

import { cn } from '@utils/cnUtils';
import { formatTokens } from '@utils/formatUtils';

import {
  BAR_LIST_GRID,
  BarRow,
  Panel,
} from '@ui/index';

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
    <Panel title={title} className="flex h-full flex-col">
      {/*
        * The list is the grid, not the row: columns have to be shared for the
        * bars to line up, and for the label and figure columns to size to the
        * widest entry in the card rather than to a number picked in advance.
        */}
      <ul className={cn('mt-3', BAR_LIST_GRID)} data-bar-list>
        {items.map((item, index) => {
          return (
            <BarRow
              index={index}
              key={item.label}
              label={item.label}
              value={item.value}
              max={max}
              formatValue={formatTokens}
            />
          );
        })}
        {items.length === 0 && (
          <li className="col-span-3 text-xs text-muted-foreground">{t('nothingRecorded')}</li>
        )}
      </ul>
    </Panel>
  );
};
