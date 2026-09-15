import { motion } from 'motion/react';

import { arriveInSequence, Eyebrow } from '@ui/index';

import type { FC, ReactNode } from 'react';

export interface ReportSectionProps {
  readonly title: string;
  // Position in the report, for the staggered arrival.
  readonly index: number;
  readonly children: ReactNode;
}

/*
 * A named group of panels. Without them the report was one long column of cards
 * with nothing to say where one subject ended and the next began.
 */
export const ReportSection: FC<ReportSectionProps> = ({
  title,
  index,
  children,
}) => {
  return (
    <motion.section className="grid gap-4" {...arriveInSequence(index)}>
      <Eyebrow as="h3">{title}</Eyebrow>
      {children}
    </motion.section>
  );
};
