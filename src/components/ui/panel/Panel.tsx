import { cn } from '@utils/cnUtils';

import { Eyebrow } from '../eyebrow/Eyebrow';

import type { FC, ReactNode } from 'react';

export interface PanelProps {
  readonly children: ReactNode;
  readonly title?: string | undefined;
  // The layout inside the surface, which varies by what the panel holds.
  readonly className?: string | undefined;
}

// The card surface every report panel, settings block and archive card sits on.
export const Panel: FC<PanelProps> = ({
  children,
  title,
  className,
}) => {
  return (
    <section
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      data-panel
    >
      {title != null && <Eyebrow as="h4">{title}</Eyebrow>}
      {children}
    </section>
  );
};
