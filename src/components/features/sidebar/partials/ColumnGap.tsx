import { PaneDivider } from '@ui/index';

import type { FC } from 'react';
import type { WidthRange } from '../hooks/usePaneLayout';

export interface ColumnGapProps {
  // A folded column has no width to resize, but the 8px still has to be
  // here or its card border lands flush against the next one's.
  readonly resizable: boolean;
  readonly label: string;
  readonly value: number;
  readonly range: WidthRange;
  readonly onResize: (delta: number) => void;
}

// The gap after a column: a drag handle while it is open, a spacer while it is folded.
export const ColumnGap: FC<ColumnGapProps> = ({
  resizable,
  label,
  value,
  range,
  onResize,
}) => {
  if (!resizable) {
    return <div className="w-2 shrink-0" />;
  }

  return (
    <PaneDivider
      label={label}
      value={value}
      min={range.min}
      max={range.max}
      orientation="horizontal"
      onResize={onResize}
    />
  );
};
