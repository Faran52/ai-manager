import { useTranslation } from 'react-i18next';

import { maxOf } from '@utils/arrayUtils';
import { cn } from '@utils/cnUtils';
import { formatTokens } from '@utils/formatUtils';

import {
  BAR_LIST_GRID,
  BarRow,
  Panel,
} from '@ui/index';

import type { FC } from 'react';

export interface BarListItem {
  readonly label: string;
  readonly value: number;
}

export interface BarListProps {
  readonly title: string;
  readonly items: readonly BarListItem[];
}

export const BarList: FC<BarListProps> = ({ title, items }) => {
  const { t } = useTranslation('common');
  const max = maxOf(items, (item) => {
    return item.value;
  });

  return (
    <Panel title={title} className="flex h-full flex-col">
      {/*
        * The list is the grid, not the row: the columns have to be shared for the
        * bars to line up and for label and figure to size to the widest entry.
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
