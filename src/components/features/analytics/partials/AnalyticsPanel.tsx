import type { FC, ReactNode } from 'react';

export interface AnalyticsPanelProps {
  readonly children: ReactNode;
  readonly title: string;
}

export const AnalyticsPanel: FC<AnalyticsPanelProps> = ({ children, title }) => {
  return (
    // Full height so panels sharing a row end level with each other.
    <section className="
      flex h-full flex-col rounded-xl border border-border bg-card p-4 shadow-sm
    "
    >
      <h4 className="
        text-[11px] font-semibold tracking-wider text-muted-foreground uppercase
      "
      >
        {title}
      </h4>
      {children}
    </section>
  );
};
