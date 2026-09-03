import { useTranslation } from 'react-i18next';

import { motion } from 'motion/react';

import { formatTokens } from '@utils/formatUtils';

import { fillTransition, MOTION_STAGGER } from '@ui/index';

import { AnalyticsPanel } from './AnalyticsPanel';

import type { StatsEffort, StatsRhythm } from '@services/stats/statsService';
import type { FC } from 'react';

export interface WorkRhythmProps {
  readonly rhythm: StatsRhythm;
  readonly effort: StatsEffort;
}

interface Slot {
  readonly key: string;
  readonly label: string;
  // Written under the bar, so a reader never has to count along the row.
  readonly tick: string;
  readonly count: number;
}

// Total time for a whole strip to fill, shared out across however many bars it has.
const SWEEP = 0.4;

const WEEKDAY_KEYS = [
  'weekdayMon',
  'weekdayTue',
  'weekdayWed',
  'weekdayThu',
  'weekdayFri',
  'weekdaySat',
  'weekdaySun',
] as const;

/*
 * Every hour carries its own label. Labelling only some of them meant counting
 * along the row to work out which bar was which, which is the thing a label is
 * supposed to save you from.
 */
const hourSlots = (counts: readonly number[]): Slot[] => {
  return counts.map((count, hour) => {
    return {
      key: String(hour),
      label: `${String(hour)}:00`,
      tick: String(hour).padStart(2, '0'),
      count,
    };
  });
};

/*
 * A bar with nothing written under it says only that something happened, not
 * when. The labels were in the hover text alone, which is no use on a touch
 * screen and no use at a glance.
 */
const Strip: FC<{ readonly slots: readonly Slot[];
  readonly caption: string; }> = ({ slots, caption }) => {
  const peak = slots.reduce((best, slot) => {
    return Math.max(best, slot.count);
  }, 0);
  /*
   * The sweep is shared rather than per bar, so 24 hours and 7 weekdays take
   * the same time to fill instead of the hours running three times longer.
   */
  const step = Math.min(MOTION_STAGGER, SWEEP / Math.max(1, slots.length));

  return (
    <div className="grid gap-1">
      <p className="text-[11px] text-muted-foreground">{caption}</p>
      <div className="flex items-end gap-0.5" role="img" aria-label={caption}>
        {slots.map((slot, index) => {
          const percent = peak === 0 ? 0 : (slot.count / peak) * 100;

          return (
            <div key={slot.key} className="grid min-w-0 flex-1 gap-1">
              <div className="flex h-16 items-end">
                <motion.div
                  title={`${slot.label}: ${formatTokens(slot.count)}`}
                  data-rhythm-bar={slot.key}
                  // The live height is mid-tween, so the settled figure is its own attribute.
                  data-rhythm-height={percent}
                  className="w-full rounded-t-sm bg-primary/70"
                  initial={{ height: '0%' }}
                  animate={{ height: `${String(percent)}%` }}
                  transition={{
                    ...fillTransition,
                    delay: index * step,
                  }}
                />
              </div>
              <span className="
                overflow-hidden text-center text-[10px] leading-none
                text-muted-foreground tabular-nums
              "
              >
                {slot.tick}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const WorkRhythm: FC<WorkRhythmProps> = ({ rhythm, effort }) => {
  const { t } = useTranslation('analytics');
  const facts: readonly (readonly [string, string])[] = [
    [t('peakHour'), rhythm.peakHour == null
      ? t('notRecorded', { ns: 'common' })
      : t('hourLabel', { hour: rhythm.peakHour })],
    [t('currentStreak'), t('dayCount', { count: rhythm.currentStreak })],
    [t('longestStreak'), t('dayCount', { count: rhythm.longestStreak })],
    [t('activeDays'), t('outOfDays', {
      active: rhythm.activeDays,
      span: rhythm.spanDays,
    })],
    [t('promptsSent'), formatTokens(effort.userMessages)],
    [t('wordsTyped'), formatTokens(effort.userWords)],
    [t('codeEdits'), formatTokens(effort.codeEdits)],
    [t('commandsRun'), formatTokens(effort.commandsRun)],
  ];

  return (
    <AnalyticsPanel title={t('workRhythm')}>
      <div className="mt-3 grid gap-4" data-work-rhythm>
        <Strip caption={t('byHour')} slots={hourSlots(rhythm.hours)} />
        <Strip
          caption={t('byWeekday')}
          slots={WEEKDAY_KEYS.map((key, slot) => {
            return {
              key,
              label: t(key),
              tick: t(key),
              count: rhythm.weekdays[slot] ?? 0,
            };
          })}
        />
        {/* The charts are one thought and the figures another. */}
        <dl className="
          grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border pt-4 text-xs
          sm:grid-cols-4
        "
        >
          {facts.map(([label, value]) => {
            return (
              <div
                key={label}
                className="flex items-baseline justify-between gap-2"
              >
                <dt className="truncate text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular-nums">{value}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </AnalyticsPanel>
  );
};
