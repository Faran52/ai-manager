import { useTranslation } from 'react-i18next';

import { formatDayLabel } from '@utils/formatUtils';

import type { FC } from 'react';

export interface DateDividerProps {
  readonly timestampMs: number;
  readonly nowMs: number;
}

export const DateDivider: FC<DateDividerProps> = ({ timestampMs, nowMs }) => {
  const { i18n } = useTranslation('session');
  const label = formatDayLabel(timestampMs, nowMs, i18n.language);

  return (
    <div
      className="flex items-center gap-3 py-1 select-none"
      role="separator"
      aria-label={label}
      data-date-divider
    >
      <span className="h-px flex-1 bg-border/50" />
      <span className="text-[11px] font-medium text-muted-foreground/80">{label}</span>
      <span className="h-px flex-1 bg-border/50" />
    </div>
  );
};
