import { useTranslation } from 'react-i18next';

import { formatDayLabel } from '@utils/formatUtils';

import { DividerLabel } from '@ui/index';

import type { FC } from 'react';

export interface DateDividerProps {
  readonly timestampMs: number;
  readonly nowMs: number;
}

export const DateDivider: FC<DateDividerProps> = ({ timestampMs, nowMs }) => {
  const { i18n } = useTranslation('session');

  return <DividerLabel label={formatDayLabel(timestampMs, nowMs, i18n.language)} />;
};
