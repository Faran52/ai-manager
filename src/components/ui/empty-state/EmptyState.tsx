import { cn } from '@utils/cnUtils';

import type { FC, ReactNode } from 'react';

export interface EmptyStateProps {
  readonly icon: ReactNode;
  readonly title: string;
  readonly hint?: string;
  readonly tone?: 'accent' | 'error';
}

const TONES: Record<NonNullable<EmptyStateProps['tone']>, string> = {
  accent: 'bg-primary/15 text-primary',
  error: 'bg-destructive/15 text-destructive',
};

export const EmptyState: FC<EmptyStateProps> = ({
  icon,
  title,
  hint,
  tone = 'accent',
}) => {
  return (
    <div
      className="
        flex flex-col items-center justify-center gap-2 px-6 py-14 text-center
      "
      data-empty-state
    >
      <span
        className={cn(`
          mb-2 flex size-20 items-center justify-center rounded-xl
          [&_svg]:size-11
        `, TONES[tone])}
        data-tone={tone}
      >
        {icon}
      </span>
      <p className="text-sm font-medium text-muted-foreground">
        {title}
      </p>
      {hint != null && (
        <p className="max-w-xs text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
};
