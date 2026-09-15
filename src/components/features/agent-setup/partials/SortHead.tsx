import { ChevronDown, ChevronUp } from 'lucide-react';

import type { FC, ReactNode } from 'react';

export type SortKey = 'alwaysOn' | 'perInvoke' | 'perTurns' | 'plugin' | 'scope' | 'state' | 'version';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  readonly key: SortKey;
  readonly direction: SortDirection;
}

export interface SortHeadProps {
  readonly sortKey: SortKey;
  readonly sort: SortState;
  readonly onSort: (key: SortKey) => void;
  readonly className?: string;
  readonly children: ReactNode;
}

const ariaSortFor = (key: SortKey, sort: SortState): 'ascending' | 'descending' | 'none' => {
  if (sort.key !== key) {
    return 'none';
  }

  return sort.direction === 'asc' ? 'ascending' : 'descending';
};

// A column heading that sorts the table on a click and shows which way it is sorted.
export const SortHead: FC<SortHeadProps> = ({
  sortKey,
  sort,
  onSort,
  className,
  children,
}) => {
  const active = sort.key === sortKey;
  const Icon = sort.direction === 'asc' ? ChevronUp : ChevronDown;

  return (
    <th scope="col" aria-sort={ariaSortFor(sortKey, sort)} className={className}>
      <button
        type="button"
        onClick={() => {
          onSort(sortKey);
        }}
        className="inline-flex items-center gap-0.5"
      >
        {children}
        {active && <Icon className="size-3" />}
      </button>
    </th>
  );
};
