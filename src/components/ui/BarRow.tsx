import type { FC } from 'react';

export interface BarRowProps {
  readonly label: string;
  readonly max: number;
  readonly value: number;
  readonly formatValue: (value: number) => string;
}

/**
 * A name, what it is worth, and a bar under both.
 *
 * Reading across a row to a figure at the far end meant the name had to be cut
 * to a fixed column and the figure squeezed into another. Stacking them gives
 * the name the width of the card and puts the figure beside what it describes.
 */
export const BarRow: FC<BarRowProps> = ({
  label,
  value,
  max,
  formatValue,
}) => {
  return (
    <li className="grid gap-1.5" data-bar-row={label}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-xs text-foreground" title={label}>
          {label}
        </span>
        <span className="
          shrink-0 font-mono text-xs whitespace-nowrap text-muted-foreground
          tabular-nums
        "
        >
          {formatValue(value)}
        </span>
      </span>
      <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary"
          data-bar-fill
          style={{ width: `${String(Math.min(100, Math.max(0, max === 0 ? 0 : Math.round((value / max) * 100))))}%` }}
        />
      </span>
    </li>
  );
};
