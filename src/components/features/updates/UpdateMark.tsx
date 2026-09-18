import { useTranslation } from 'react-i18next';

import { appConfig } from '@config/appConfig';

import { Tooltip } from '@ui/index';

import type { FC } from 'react';
import type { ProbeStage } from './hooks/useUpdateProbe';

export interface UpdateMarkProps {
  readonly stage: ProbeStage;
  readonly progress?: number | undefined;
}

const SIZE = 22;
const CENTRE = SIZE / 2;
const SPIN = `rotate(-90 ${String(SIZE / 2)} ${String(SIZE / 2)})`;
const RADIUS = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const UpdateMark: FC<UpdateMarkProps> = ({ stage, progress }) => {
  const { t } = useTranslation('update');

  if (stage !== 'downloading') {
    return (
      <Tooltip content={t('installed', { version: appConfig.version })} side="right">
        <span
          className="
            font-mono text-[0.5625rem] leading-none text-dim tabular-nums
          "
          data-update-mark
        >
          {appConfig.version}
        </span>
      </Tooltip>
    );
  }

  const taken = progress ?? 0;
  const label = progress == null
    ? t('downloading')
    : t('downloadingPercent', { percent: Math.round(taken * 100) });

  return (
    <Tooltip content={label} side="right">
      <span
        className="text-primary"
        role="progressbar"
        aria-label={label}
        {...progress == null
          ? {}
          : {
              'aria-valuenow': Math.round(taken * 100),
              'aria-valuemin': 0,
              'aria-valuemax': 100,
            }}
        data-update-mark="downloading"
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${String(SIZE)} ${String(SIZE)}`} aria-hidden="true">
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={2.5}
          />
          {/* Drawn from the top, so it fills the way a clock reads. */}
          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - taken)}
            transform={SPIN}
            className="transition-[stroke-dashoffset]"
          />
        </svg>
      </span>
    </Tooltip>
  );
};
