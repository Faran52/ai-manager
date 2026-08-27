import type { FC } from 'react';

export interface BarRowProps {
  readonly label: string;
  readonly max: number;
  readonly value: number;
  readonly formatValue: (value: number) => string;
}

export const BarRow: FC<BarRowProps> = ({
  label,
  value,
  max,
  formatValue,
}) => {
  return (
    <li className="flex items-center gap-2" data-bar-row={label}>
      <span className="
        w-32 shrink-0 truncate font-mono text-xs text-muted-foreground
      "
      >
        {label}
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${String(Math.min(100, Math.max(0, max === 0 ? 0 : Math.round((value / max) * 100))))}%` }}
        />
      </span>
      <span className="
        w-14 shrink-0 text-end font-mono text-xs text-muted-foreground
      "
      >
        {formatValue(value)}
      </span>
    </li>
  );
};
