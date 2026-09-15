import { DividerLabel } from '@ui/index';

import type { FC } from 'react';

export interface SummaryDividerProps {
  readonly text: string;
}

export const SummaryDivider: FC<SummaryDividerProps> = ({ text }) => {
  return <DividerLabel label={text} />;
};
