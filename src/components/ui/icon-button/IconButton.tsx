import { cn } from '@utils/cnUtils';

import { Tooltip } from '../tooltip/Tooltip';

import type { FC, ReactNode } from 'react';

export interface IconButtonProps {
  // The accessible name and the tooltip, since the control has no visible text.
  readonly label: string;
  readonly icon: ReactNode;
  readonly onClick: () => void;
  // A toggle's on state, announced as aria-pressed and drawn lit.
  readonly pressed?: boolean | undefined;
  /*
   * ghost: a quiet control in a header. toolbar: a titlebar action that lights
   * with the accent when pressed. segment: one half of a raised pair.
   */
  readonly variant?: 'ghost' | 'toolbar' | 'segment';
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
}

const VARIANTS: Record<NonNullable<IconButtonProps['variant']>, string> = {
  ghost: `
    size-6 rounded-md text-muted-foreground
    hover:bg-accent hover:text-foreground
  `,
  toolbar: `
    h-7 rounded-lg px-2 text-muted-foreground
    hover:bg-accent hover:text-accent-foreground
  `,
  segment: `
    h-5.25 w-6.5 rounded-sm text-muted-foreground
    hover:text-foreground
  `,
};

const PRESSED: Record<NonNullable<IconButtonProps['variant']>, string> = {
  ghost: 'bg-accent text-foreground',
  toolbar: 'bg-primary/10 text-primary',
  segment: 'bg-card text-foreground',
};

// Icon-only means tooltip, not title: the name has to reach a keyboard too.
export const IconButton: FC<IconButtonProps> = ({
  label,
  icon,
  onClick,
  pressed,
  variant = 'ghost',
  side,
}) => {
  return (
    <Tooltip content={label} side={side ?? 'top'}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        data-icon-button={variant}
        className={cn(
          `
            flex shrink-0 items-center justify-center transition-colors
            focus-visible:ring-2 focus-visible:ring-ring
            focus-visible:outline-none
          `,
          VARIANTS[variant],
          pressed === true && PRESSED[variant],
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
};
