import { cn } from '@utils/cnUtils';

import type { SortKey, SortState } from './partials/SortHead';

export interface Column {
  readonly key: SortKey;
  readonly labelKey: string;
  readonly className: string;
}

export const CELL = 'truncate py-2 pe-4 text-start align-middle';

/*
 * The state cell holds a control, not text: truncate would clip the switch and
 * paint a stray ellipsis beside it.
 */
export const SWITCH_CELL = 'py-2 pe-4 text-start align-middle whitespace-nowrap';

const HEAD = cn(CELL, `
  sticky top-0 z-10 bg-popover text-figure font-medium tracking-wider
  text-muted-foreground uppercase
`);

export const NUMERIC = 'text-end';

export const TABLE = 'w-full table-fixed border-collapse font-mono text-body';

export const ROW = `
  border-b border-border/40 last:border-0
  hover:bg-muted-foreground/5
`;

export const TOKENS = new Intl.NumberFormat();

export const PER_TURNS = 1000;

export const SHA = /^[0-9a-f]{7,40}$/u;

export const DEFAULT_SORT: SortState = {
  key: 'plugin',
  direction: 'asc',
};

// Head cells in table order; the widths sum to 100 of a table-fixed layout.
export const COLUMNS: readonly Column[] = [
  {
    key: 'plugin',
    labelKey: 'plugin',
    className: cn(HEAD, 'w-[26%] ps-2'),
  },
  {
    key: 'scope',
    labelKey: 'scope',
    className: cn(HEAD, 'w-[10%]'),
  },
  {
    key: 'version',
    labelKey: 'version',
    className: cn(HEAD, 'w-[13%]'),
  },
  {
    key: 'alwaysOn',
    labelKey: 'costsAlwaysOn',
    className: cn(HEAD, NUMERIC, 'w-[13%]'),
  },
  {
    key: 'perInvoke',
    labelKey: 'costsPerInvoke',
    className: cn(HEAD, NUMERIC, 'w-[13%]'),
  },
  {
    key: 'perTurns',
    labelKey: 'costsPerTurns',
    className: cn(HEAD, NUMERIC, 'w-[15%]'),
  },
  {
    key: 'state',
    labelKey: 'state',
    className: cn(HEAD, 'w-[10%]'),
  },
];
