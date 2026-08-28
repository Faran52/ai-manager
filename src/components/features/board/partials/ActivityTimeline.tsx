import { useTranslation } from 'react-i18next';

import type { FC } from 'react';
import type { BoardDay } from '../boardModel';

export interface ActivityTimelineProps {
  readonly days: readonly BoardDay[];
}

export const ActivityTimeline: FC<ActivityTimelineProps> = ({ days }) => {
  const { t } = useTranslation('board');

  if (days.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-1.5" data-activity-timeline>
      <h4 className="text-xs font-semibold text-foreground">{t('timeline')}</h4>
      <div className="flex h-16 items-end gap-0.5" role="list" aria-label={t('timeline')}>
        {days.map((day) => {
          return (
            <span
              key={day.date}
              role="listitem"
              title={t('dayLabel', {
                date: day.date,
                count: day.sessions,
              })}
              aria-label={t('dayLabel', {
                date: day.date,
                count: day.sessions,
              })}
              className="min-w-1 flex-1 rounded-t-[2px] bg-primary/70"
              style={{ height: `${String(Math.max(6, day.intensity * 100))}%` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{days[0]?.date}</span>
        <span>{days.at(-1)?.date}</span>
      </div>
    </div>
  );
};
