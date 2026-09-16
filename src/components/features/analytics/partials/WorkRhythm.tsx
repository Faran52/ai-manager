import { useTranslation } from 'react-i18next';

import { maxOf } from '@utils/arrayUtils';
import { cn } from '@utils/cnUtils';
import { formatTokens } from '@utils/formatUtils';

import {
  BAR_LIST_GRID,
  BarRow,
  Panel,
} from '@ui/index';

import { hourSlots } from '../utils/rhythmSlotUtils';

import { RhythmStrip } from './RhythmStrip';

import type { StatsEffort, StatsRhythm } from '@services/stats/statsService';
import type { FC } from 'react';

export interface WorkRhythmProps {
  readonly rhythm: StatsRhythm;
  readonly effort: StatsEffort;
}

const WEEKDAY_KEYS = [
  'weekdayMon',
  'weekdayTue',
  'weekdayWed',
  'weekdayThu',
  'weekdayFri',
  'weekdaySat',
  'weekdaySun',
] as const;

export const WorkRhythm: FC<WorkRhythmProps> = ({ rhythm, effort }) => {
  const { t } = useTranslation('analytics');
  const weekdayPeak = maxOf(rhythm.weekdays, (count) => {
    return count;
  });
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
    <Panel title={t('workRhythm')} className="flex h-full flex-col">
      <div className="mt-3 grid gap-4" data-work-rhythm>
        <RhythmStrip caption={t('byHour')} slots={hourSlots(rhythm.hours)} />
        {/*
          * Seven values need no second chart form: they are name, magnitude and
          * figure, the row every ranked list here uses.
          */}
        <div className="grid gap-1">
          <p className="text-body text-muted-foreground">{t('byWeekday')}</p>
          <ul className={cn(BAR_LIST_GRID)}>
            {WEEKDAY_KEYS.map((key, slot) => {
              return (
                <BarRow
                  key={key}
                  index={slot}
                  label={t(key)}
                  max={weekdayPeak}
                  value={rhythm.weekdays[slot] ?? 0}
                  formatValue={formatTokens}
                />
              );
            })}
          </ul>
        </div>
        {/* The charts are one thought and the figures another. A figure is a
            cell with its label above it, not a label and a value colliding on
            one line. */}
        <dl className="
          grid grid-cols-2 gap-x-3 gap-y-3.5 border-t border-border pt-4
          sm:grid-cols-4
        "
        >
          {facts.map(([label, value]) => {
            return (
              <div key={label} className="grid gap-0.5">
                <dt className="truncate text-figure text-faint">{label}</dt>
                <dd className="
                  font-mono text-value font-semibold text-foreground
                  tabular-nums
                "
                >
                  {value}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </Panel>
  );
};
