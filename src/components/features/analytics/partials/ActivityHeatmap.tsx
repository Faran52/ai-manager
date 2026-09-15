import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { motion } from 'motion/react';

import { formatTokens } from '@utils/formatUtils';

import {
  MOTION_STAGGER,
  riseTransition,
  Tooltip,
} from '@ui/index';

import {
  levelClass,
  levelFor,
  monthsOf,
  WASH_SCALE,
  weeksTo,
} from '../utils/heatmapUtils';

import { AnalyticsPanel } from './AnalyticsPanel';

import type { DayActivity } from '@services/stats/statsService';
import type { FC, PointerEvent } from 'react';

interface HoveredDay {
  readonly date: string;
  readonly tokens: number;
  readonly x: number;
  readonly y: number;
}

export interface ActivityHeatmapProps {
  readonly activity: readonly DayActivity[];
}

// Seven rows, keyed by weekday so the grid never keys on an array index. Monday,
// Wednesday and Friday carry a label; naming every row leaves no room for the grid.
const ROW_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const ROW_LABEL: Partial<Record<(typeof ROW_KEYS)[number], string>> = {
  mon: 'weekdayMon',
  wed: 'weekdayWed',
  fri: 'weekdayFri',
};

/**
 * A fixed height, not the whole card.
 *
 * The grid filled the panel with flex-1, but a panel's height is set by whichever
 * sibling in its row is taller. An agent with a long tool list drew tall cells
 * and one with a short list drew flat pills, so the same heatmap looked different
 * per agent. A fixed height keeps a cell one shape for everyone; WEEKS_SHOWN
 * pins the width the same way.
 */
export const ActivityHeatmap: FC<ActivityHeatmapProps> = ({ activity }) => {
  const { t } = useTranslation('analytics');
  const [todayMs] = useState(() => {
    return Date.now();
  });
  const [hovered, setHovered] = useState<HoveredDay | null>(null);
  const peak = activity.reduce((best, day) => {
    return Math.max(best, day.tokens);
  }, 0);
  const months = monthsOf(weeksTo(activity, todayMs));

  /*
   * One shared tooltip for every cell instead of one Tooltip (Provider+Root+
   * Portal each) per cell: staggering 365 of those is the same cost the
   * comment above already rejects for animation, worse since each also
   * carries Radix state. The cell just reports its own rect on entry.
   */
  const hoverDay = (day: DayActivity) => {
    return (event: PointerEvent<HTMLSpanElement>): void => {
      const rect = event.currentTarget.getBoundingClientRect();

      setHovered({
        date: day.date,
        tokens: day.tokens,
        x: rect.left + (rect.width / 2),
        y: rect.top,
      });
    };
  };

  return (
    <AnalyticsPanel title={t('activity')}>
      <div className="mt-3 flex h-52 gap-2" data-activity-heatmap>
        <div className="grid shrink-0 grid-rows-7 gap-1 pt-4">
          {ROW_KEYS.map((weekday) => {
            const label = ROW_LABEL[weekday];

            return (
              <span
                key={weekday}
                className="
                  flex items-center text-figure leading-none
                  text-muted-foreground
                "
              >
                {label == null ? '' : t(label)}
              </span>
            );
          })}
        </div>

        <div
          className="flex min-w-0 flex-1 gap-3"
          role="img"
          aria-label={t('dailyHeatmap')}
          onPointerLeave={() => {
            setHovered(null);
          }}
        >
          {months.map((month, index) => {
            return (
              <motion.div
                key={month.key}
                className="flex min-w-0 flex-col gap-1"
                // In proportion to the weeks it holds, so a cell is one size throughout.
                style={{ flex: `${String(month.weeks.length)} 1 0%` }}
                data-heatmap-month={month.label}
                /*
                 * A month at a time, not a day: staggering 365 cells would
                 * mount 365 animations to sweep a grid that reads as columns.
                 */
                initial={{
                  opacity: 0,
                  y: 4,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  ...riseTransition,
                  delay: index * MOTION_STAGGER,
                }}
              >
                <span className="
                  h-3 text-figure leading-none text-muted-foreground
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
                              onPointerEnter={hoverDay(day)}
                              data-date={day.date}
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
              </motion.div>
            );
          })}
        </div>
        {hovered != null && (
          <Tooltip
            content={t('heatmapDay', {
              date: hovered.date,
              tokens: formatTokens(hovered.tokens),
            })}
            position={{
              x: hovered.x,
              y: hovered.y,
            }}
            open
          />
        )}
      </div>

      <div className="
        mt-3 flex items-center justify-end gap-1 text-figure
        text-muted-foreground
      "
      >
        <span>{t('heatmapLess')}</span>
        {WASH_SCALE.map((wash) => {
          return (
            <span
              key={wash}
              className={`
                size-3 rounded-sm
                ${wash}
              `}
            />
          );
        })}
        <span>{t('heatmapMore')}</span>
      </div>
    </AnalyticsPanel>
  );
};
