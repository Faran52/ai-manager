import { motion } from 'motion/react';

import { fillTransition, MOTION_STAGGER } from '../constants';
import { Tooltip } from '../tooltip/Tooltip';

import type { FC, ReactNode } from 'react';

export interface BarRowProps {
  readonly label: string;
  readonly max: number;
  readonly value: number;
  readonly formatValue: (value: number) => string;
  // Position in its list, so a list fills top to bottom rather than all at once.
  readonly index?: number | undefined;
  // A second figure, in its own column. The list adds the column to its grid.
  readonly trailing?: ReactNode | undefined;
  /*
   * A mark qualifying the label, inside the label's own cell: a pricing basis,
   * a plugin that disambiguates a skill name. Not a figure, so not a column.
   */
  readonly qualifier?: ReactNode | undefined;
}

/*
 * The columns every ranked list shares. Label and figure size to their widest
 * entry so neither holds a dead strip, and the bar takes the rest, which keeps
 * the track identical on every row. Bars are only comparable if it is.
 */
export const BAR_LIST_GRID = `
  grid items-center gap-x-3 gap-y-2
  [grid-template-columns:minmax(0,max-content)_minmax(3.5rem,1fr)_max-content]
`;

/**
 * One row form for everything ranked: label, bar on a shared baseline, figure.
 *
 * The row is `display: contents` so its three parts become cells of the list's
 * own grid. That is what keeps every bar in a card the same length, which is
 * the only thing that makes two bars comparable, while the label and the figure
 * take exactly the width their longest entry needs and no more.
 */
export const BarRow: FC<BarRowProps> = ({
  label,
  value,
  max,
  formatValue,
  index = 0,
  trailing,
  qualifier,
}) => {
  // The bar animates from empty, so its scale mid-flight is not the proportion.
  // data-bar-fill carries the settled figure for tests and for reading the DOM.
  const percent = Math.min(100, Math.max(0, max === 0 ? 0 : Math.round((value / max) * 100)));

  return (
    <li className="contents" data-bar-row={label}>
      <span className="flex min-w-0 items-center gap-1.5">
        <Tooltip content={label}>
          <span className="min-w-0 truncate font-mono text-body text-foreground">
            {label}
          </span>
        </Tooltip>
        {qualifier}
      </span>
      {/*
        * The fill scales rather than widening. Width is a layout property, so
        * animating it reflows every row below on each frame, and an analytics
        * pane holds dozens of these. A transform stays on the compositor.
        */}
      <span className="block h-1.5 overflow-hidden rounded-full bg-recess">
        <motion.span
          animate={{ scaleX: percent / 100 }}
          className="
            block h-full origin-left bg-primary
            rtl:origin-right
          "
          data-bar-fill={percent}
          initial={{ scaleX: 0 }}
          transition={{
            ...fillTransition,
            delay: index * MOTION_STAGGER,
          }}
        />
      </span>
      <span className="
        shrink-0 text-end font-mono text-figure whitespace-nowrap
        text-muted-foreground tabular-nums
      "
      >
        {formatValue(value)}
      </span>
      {trailing}
    </li>
  );
};
