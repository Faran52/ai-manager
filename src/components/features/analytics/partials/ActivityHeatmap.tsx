import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatTokens } from '@utils/formatUtils';

import {
  IDLE_CLASS,
  levelClass,
  levelFor,
  monthsOf,
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

/**
 * The grid takes the whole card, in both directions.
 *
 * A day is a cell of whatever size that leaves, rather than a fixed square with
 * the rest of the card empty around it. How coarse the picture is comes from
 * how many weeks are shown, which is decided in one place.
 */
export const ActivityHeatmap: FC<ActivityHeatmapProps> = ({ activity }) => {
  const { t } = useTranslation('analytics');
  const [todayMs] = useState(() => {
    return Date.now();
  });
  const peak = activity.reduce((best, day) => {
    return Math.max(best, day.tokens);
  }, 0);
  const months = monthsOf(weeksTo(activity, todayMs));

  return (
    <AnalyticsPanel title={t('activity')}>
      <div className="mt-3 flex min-h-0 flex-1 gap-2" data-activity-heatmap>
        <div className="grid shrink-0 grid-rows-7 gap-1 pt-4">
          {ROW_LABELS.map((label, weekday) => {
            return (
              <span
                key={String(weekday)}
                className="
                  flex items-center text-[10px] leading-none
                  text-muted-foreground
                "
              >
                {label == null ? '' : t(label)}
              </span>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-1 gap-3" role="img" aria-label={t('dailyHeatmap')}>
          {months.map((month) => {
            return (
              <div
                key={month.key}
                className="flex min-w-0 flex-col gap-1"
                // In proportion to the weeks it holds, so a cell is one size throughout.
                style={{ flex: `${String(month.weeks.length)} 1 0%` }}
                data-heatmap-month={month.label}
              >
                <span className="
                  h-3 text-[10px] leading-none text-muted-foreground
                "
                >
                  {month.label}
                </span>
                <div className="
                  grid min-h-0 flex-1 auto-cols-fr grid-flow-col gap-1
                "
                >
                  {month.weeks.map((week) => {
                    return (
                      <div key={week.key} className="grid grid-rows-7 gap-1">
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
                                size-full rounded-sm
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
            );
          })}
        </div>
      </div>

      <div className="
        mt-3 flex items-center justify-end gap-1 text-[10px]
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
