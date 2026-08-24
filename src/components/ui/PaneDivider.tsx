import { useRef } from 'react';

import type {
  FC,
  KeyboardEvent,
  PointerEvent,
} from 'react';

export interface PaneDividerProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onResize: (deltaY: number) => void;
}

const KEY_STEP = 24;

// A slider, not a separator: it sets a value in a range, which is operable by assistive tech.
export const PaneDivider: FC<PaneDividerProps> = ({
  label,
  value,
  min,
  max,
  onResize,
}) => {
  const lastClientYRef = useRef(0);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    lastClientYRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      onResize(event.clientY - lastClientYRef.current);
      lastClientYRef.current = event.clientY;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      onResize(event.key === 'ArrowUp' ? -KEY_STEP : KEY_STEP);
    }
  };

  return (
    <div
      role="slider"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
      className="
        group flex h-2 shrink-0 cursor-row-resize touch-none items-center
        justify-center border-t border-border outline-none
        focus-visible:bg-primary/20
      "
    >
      <span className="
        h-0.5 w-8 rounded-full bg-transparent transition-colors
        group-hover:bg-muted-foreground/40
      "
      />
    </div>
  );
};
