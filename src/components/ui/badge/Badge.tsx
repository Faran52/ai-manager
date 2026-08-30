import { cn } from '@utils/cnUtils';

import type { FC, ReactNode } from 'react';

export interface BadgeProps {
  readonly children: ReactNode;
  readonly tone?: 'neutral' | 'accent' | 'success' | 'error' | 'warn';
  readonly title?: string;
}

const TONES: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-muted-foreground/10 text-muted-foreground',
  accent: 'bg-primary/10 text-primary',
  success: 'bg-ok/10 text-ok',
  error: 'bg-destructive/10 text-destructive',
  warn: 'bg-warn/15 text-warn',
};

export const Badge: FC<BadgeProps> = ({
  children,
  tone = 'neutral',
  title,
}) => {
  return (
    <span
      title={title}
      className={cn(
        `
          inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono
          text-[11px] leading-none whitespace-nowrap
        `,
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
};
