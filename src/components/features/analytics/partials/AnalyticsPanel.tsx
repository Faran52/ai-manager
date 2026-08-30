import type { FC, ReactNode } from 'react';

export interface AnalyticsPanelProps {
  readonly children: ReactNode;
  readonly title: string;
}

export const AnalyticsPanel: FC<AnalyticsPanelProps> = ({ children, title }) => {
  return (
    <section className="analytics-panel">
      <h4 className="analytics-title">{title}</h4>
      {children}
    </section>
  );
};
