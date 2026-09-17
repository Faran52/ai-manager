import type { FC } from 'react';

export interface DividerLabelProps {
  readonly label: string;
}

/*
 * A rule broken by its own text, naming what the break is for. Clamped because a
 * summary runs long and would squeeze both rules out.
 */
export const DividerLabel: FC<DividerLabelProps> = ({ label }) => {
  return (
    <div
      className="flex items-center gap-3 py-1 tracking-wide select-none"
      role="separator"
      aria-label={label}
      data-divider-label
    >
      <span className="h-px flex-1 bg-hair" />
      <span className="max-w-[70%] truncate text-figure text-dim">{label}</span>
      <span className="h-px flex-1 bg-hair" />
    </div>
  );
};
