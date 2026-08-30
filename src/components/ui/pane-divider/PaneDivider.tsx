import { useRef } from 'react';

import { cn } from '@utils/cnUtils';

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
  readonly orientation: 'horizontal' | 'vertical';
  readonly onResize: (delta: number) => void;
}

const KEY_STEP = 24;

// A slider, not a separator: it sets a value in a range, which is operable by assistive tech.
export const PaneDivider: FC<PaneDividerProps> = ({
  label,
  value,
  min,
  max,
  orientation,
  onResize,
}) => {
  const lastPositionRef = useRef(0);

  const positionOf = (event: PointerEvent<HTMLDivElement>): number => {
    return orientation === 'horizontal' ? event.clientX : event.clientY;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    lastPositionRef.current = positionOf(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      const position = positionOf(event);

      onResize(position - lastPositionRef.current);
      lastPositionRef.current = position;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const decreaseKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    const increaseKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';

    if (event.key === decreaseKey || event.key === increaseKey) {
      event.preventDefault();
      onResize(event.key === decreaseKey ? -KEY_STEP : KEY_STEP);
    }
  };

  return (
    <div
      role="slider"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
      className={cn(
        `
          group z-10 flex shrink-0 touch-none items-center justify-center
          outline-none
          focus-visible:bg-primary/20
        `,
        orientation === 'horizontal'
          ? 'h-full w-2 cursor-col-resize border-s border-border'
          : 'h-2 w-full cursor-row-resize border-t border-border',
      )}
    >
      <span className={cn(
        `
          rounded-full bg-transparent transition-colors
          group-hover:bg-muted-foreground/45
        `,
        orientation === 'horizontal' ? 'h-10 w-0.5' : 'h-0.5 w-10',
      )}
      />
    </div>
  );
};
