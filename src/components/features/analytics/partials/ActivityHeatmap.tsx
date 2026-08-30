import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatTokens } from '@utils/formatUtils';

import {
  IDLE_CLASS,
  levelClass,
  levelFor,
  weeksTo,
} from '../utils/heatmapUtils';

import { AnalyticsPanel } from './AnalyticsPanel';

import type { DayActivity } from '@services/stats/statsService';
import type { FC } from 'react';

export interface ActivityHeatmapProps {
  readonly activity: readonly DayActivity[];
}

// Monday, Wednesday and Friday only: naming every row leaves no room for the grid.
const ROW_LABELS: readonly (string | undefined)[] = [
  'weekdayMon',
  undefined,
  'weekdayWed',
  undefined,
  'weekdayFri',
  undefined,
  undefined,
];

const SCALE = [0, 1, 2, 3];

export const ActivityHeatmap: FC<ActivityHeatmapProps> = ({ activity }) => {
  const { t } = useTranslation('analytics');
  const [todayMs] = useState(() => {
    return Date.now();
  });
  const peak = activity.reduce((best, day) => {
    return Math.max(best, day.tokens);
  }, 0);
  const weeks = weeksTo(activity, todayMs);

  return (
    <AnalyticsPanel title={t('activity')}>
      <div className="mt-3 flex gap-2 overflow-x-auto" data-activity-heatmap>
        <div className="grid shrink-0 gap-1 pt-4">
          {ROW_LABELS.map((label, weekday) => {
            return (
              <span
                key={String(weekday)}
                className="
                  flex h-3 items-center text-[10px] leading-none
                  text-muted-foreground
                "
              >
                {label == null ? '' : t(label)}
              </span>
            );
          })}
        </div>

        <div className="grid grid-flow-col gap-1" role="img" aria-label={t('dailyHeatmap')}>
          {weeks.map((week) => {
            return (
              <div key={week.key} className="grid gap-1">
                <span className="
                  h-3 text-[10px] leading-none text-muted-foreground
                "
                >
                  {week.month ?? ''}
                </span>
                {week.days.map((day) => {
                  return (
                    <span
                      key={day.date}
                      title={t('heatmapDay', {
                        date: day.date,
                        tokens: formatTokens(day.tokens),
                      })}
                      data-level={String(levelFor(day.tokens, peak))}
                      className={`
                        size-3 rounded-sm
                        ${levelClass(day.tokens, peak)}
                      `}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="
        mt-2 flex items-center justify-end gap-1 text-[10px]
        text-muted-foreground
      "
      >
        <span>{t('heatmapLess')}</span>
        {SCALE.map((level) => {
          return (
            <span
              key={level}
              className={`
                size-3 rounded-sm
                ${level === 0 ? IDLE_CLASS : levelClass(level, 3)}
              `}
            />
          );
        })}
        <span>{t('heatmapMore')}</span>
      </div>
    </AnalyticsPanel>
  );
};
