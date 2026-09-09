import type { FC } from 'react';

export interface SummaryDividerProps {
  readonly text: string;
}

export const SummaryDivider: FC<SummaryDividerProps> = ({ text }) => {
  return (
    <div
      className="flex items-center gap-3 py-1 tracking-wide select-none"
      data-summary-divider
    >
      <span className="h-px flex-1 bg-hair" />
      <span className="max-w-[70%] truncate text-figure text-dim">{text}</span>
      <span className="h-px flex-1 bg-hair" />
    </div>
  );
};
