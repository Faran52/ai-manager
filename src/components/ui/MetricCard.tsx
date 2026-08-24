import type { FC, ReactNode } from 'react';

export interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly hint?: string | undefined;
  readonly icon?: ReactNode;
}

export const MetricCard: FC<MetricCardProps> = ({
  label,
  value,
  hint,
  icon,
}) => {
  return (
    <div
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
      data-metric-card
    >
      <div className="
        flex items-center gap-1.5 text-[11px] font-medium tracking-wider
        text-muted-foreground uppercase
      "
      >
        {icon}
        {label}
      </div>
      <p
        className="mt-1 font-mono text-2xl font-semibold text-foreground"
        data-metric-value
      >
        {value}
      </p>
      {hint != null && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
};
