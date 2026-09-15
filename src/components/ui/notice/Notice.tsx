import { CircleAlert, TriangleAlert } from 'lucide-react';

import { cn } from '@utils/cnUtils';

import type { FC, ReactNode } from 'react';

export interface NoticeProps {
  readonly children: ReactNode;
  // Error is something that failed; warn is something to know before acting.
  readonly tone?: 'error' | 'warn';
}

const TONES: Record<NonNullable<NoticeProps['tone']>, string> = {
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
  warn: 'border-warn/40 bg-warn/10 text-warn',
};

// One line of feedback beside the thing it is about, with its own icon.
export const Notice: FC<NoticeProps> = ({ children, tone = 'error' }) => {
  const Icon = tone === 'error' ? CircleAlert : TriangleAlert;

  return (
    <p
      className={cn(`
        flex items-center gap-2 rounded-lg border px-3 py-2 text-xs
      `, TONES[tone])}
      data-notice
      data-tone={tone}
    >
      <Icon className="size-3.5 shrink-0" />
      {children}
    </p>
  );
};
