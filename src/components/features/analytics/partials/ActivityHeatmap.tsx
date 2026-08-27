import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatTokens } from '@utils/formatUtils';

import { AnalyticsPanel } from './AnalyticsPanel';
import { levelClass, levelFor } from './heatmapLevels';

import type { DayActivity } from '@services/stats/statsService';
import type { FC } from 'react';

export interface ActivityHeatmapProps {
  readonly activity: readonly DayActivity[];
}

interface ActivityDay {
  readonly date: string;
  readonly messages: number;
  readonly tokens: number;
}

export const ActivityHeatmap: FC<ActivityHeatmapProps> = ({ activity }) => {
  const { t } = useTranslation('analytics');
  const [today] = useState(() => {
    return new Date();
  });
  const byDate = new Map(activity.map((day) => {
    return [day.date, day];
  }));
  const peak = activity.reduce((best, day) => {
    return Math.max(best, day.tokens);
  }, 0);
  const days: ActivityDay[] = [];

  const span = 7 * 26;

  for (let offset = span - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const hit = byDate.get(key);

    days.push({
      date: key,
      tokens: hit?.tokens ?? 0,
      messages: hit?.messages ?? 0,
    });
  }

  return (
    <AnalyticsPanel title={t('activity')}>
      <div
        className="mt-3 flex flex-wrap gap-1"
        role="img"
        aria-label={t('dailyHeatmap')}
        data-activity-heatmap
      >
        {days.map((day) => {
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
    </AnalyticsPanel>
  );
};
