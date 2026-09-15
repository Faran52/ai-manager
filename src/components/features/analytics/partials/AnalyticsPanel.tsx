import { Eyebrow } from '@ui/index';

import type { FC, ReactNode } from 'react';

export interface AnalyticsPanelProps {
  readonly children: ReactNode;
  readonly title: string;
}

export const AnalyticsPanel: FC<AnalyticsPanelProps> = ({ children, title }) => {
  return (
    // Full height so panels sharing a row end level with each other.
    <section className="
      flex h-full flex-col rounded-lg border border-border bg-card p-4 shadow-sm
    "
    >
      <Eyebrow as="h4">{title}</Eyebrow>
      {children}
    </section>
  );
};
