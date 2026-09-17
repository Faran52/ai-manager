import { cn } from '@utils/cnUtils';

import type { FC, ReactNode } from 'react';

export interface EyebrowProps {
  readonly children: ReactNode;
  // The element the label is: a heading over a group, a term in a list, a span.
  readonly as?: 'h3' | 'h4' | 'p' | 'span' | 'dt';
  // body is a section label; figure is the smaller label beside a value.
  readonly size?: 'body' | 'figure';
  readonly tone?: 'muted' | 'warn';
  // Position only (padding, truncation); the type itself is fixed here.
  readonly className?: string;
}

const TONES: Record<NonNullable<EyebrowProps['tone']>, string> = {
  muted: 'text-muted-foreground',
  warn: 'text-warn',
};

/*
 * The tracked uppercase label report sections, health groups and settings groups
 * all wear: one place for the size and the tracking, so no new screen drifts.
 */
export const Eyebrow: FC<EyebrowProps> = ({
  children,
  as: Tag = 'span',
  size = 'body',
  tone = 'muted',
  className,
}) => {
  return (
    <Tag
      className={cn(
        'font-semibold tracking-wider uppercase',
        size === 'body' ? 'text-body' : 'text-figure',
        TONES[tone],
        className,
      )}
      data-eyebrow
    >
      {children}
    </Tag>
  );
};
