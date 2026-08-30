import { cn } from '@utils/cnUtils';

import type {
  FC,
  MouseEventHandler,
  ReactNode,
} from 'react';

export interface ButtonProps {
  readonly children: ReactNode;
  readonly onClick?: MouseEventHandler<HTMLButtonElement> | undefined;
  readonly variant?: 'primary' | 'subtle' | 'ghost';
  readonly size?: 'sm' | 'md';
  readonly type?: 'button' | 'submit';
  readonly disabled?: boolean;
  readonly pressed?: boolean;
  readonly title?: string;
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
  subtle: cn(
    `
      bg-muted text-foreground
      hover:bg-accent
    `,
  ),
  ghost: 'text-muted-foreground hover:bg-accent',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-7 gap-1 px-2 text-xs',
  md: 'h-9 gap-1.5 px-3 text-sm',
};

export const Button: FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'subtle',
  size = 'md',
  type = 'button',
  disabled = false,
  pressed,
  title,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      title={title}
      className={cn(
        `
          inline-flex items-center justify-center rounded-md font-medium
          transition-colors
        `,
        `
          focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2
        `,
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
      )}
    >
      {children}
    </button>
  );
};
