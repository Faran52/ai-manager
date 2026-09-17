import { useTranslation } from 'react-i18next';

import { formatDayLabel } from '@utils/formatUtils';

import type { FC } from 'react';

export interface FloatingDateProps {
  // Zero when a separator is already on screen naming the day, so nothing floats.
  readonly timestampMs: number;
  readonly nowMs: number;
}

export const FloatingDate: FC<FloatingDateProps> = ({ timestampMs, nowMs }) => {
  const { i18n } = useTranslation('session');

  if (timestampMs === 0) {
    return null;
  }

  return (
    /* Zero height: the pill floats over the transcript rather than sitting in
       it, so the rows below keep their offset whether or not it is showing. */
    <div className="
      pointer-events-none sticky top-0 z-10 flex h-0 items-start justify-center
    "
    >
      <span
        className="
          rounded-full border border-border bg-card/90 px-2.5 py-0.5 text-figure
          font-medium text-muted-foreground shadow-sm backdrop-blur-sm
        "
        data-floating-date
      >
        {formatDayLabel(timestampMs, nowMs, i18n.language)}
      </span>
    </div>
  );
};
