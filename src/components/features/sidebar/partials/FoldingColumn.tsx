import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { fadeTransition, foldTransition } from '@ui/index';

import { COLLAPSED_WIDTH } from '../hooks/usePaneLayout';

import type { TargetAndTransition } from 'motion/react';
import type { FC, ReactNode } from 'react';

export interface FoldingColumnProps {
  readonly open: boolean;
  readonly width: number;
  // What the column shows once folded: its strip of marks.
  readonly strip: ReactNode;
  readonly children: ReactNode;
  // The surface colour: the projects column sits on the sidebar tone, the sessions on the background.
  readonly className: string;
  // Set on the column that can leave the pane altogether, so it slides shut when it does.
  readonly exit?: TargetAndTransition | undefined;
}

/*
 * A column is never swapped for its strip: the width springs between the
 * two on a spring that carries velocity through an interrupting click, and
 * the old content fades out as the new fades in, so folding reads as the
 * column handing its width back rather than two states cutting.
 */
export const FoldingColumn: FC<FoldingColumnProps> = ({
  open,
  width,
  strip,
  children,
  className,
  exit,
}) => {
  return (
    <motion.section
      initial={false}
      animate={{ width: open ? width : COLLAPSED_WIDTH }}
      {...exit == null ? {} : { exit }}
      transition={foldTransition}
      className={cn(`
        relative flex min-h-0 shrink-0 flex-col overflow-hidden rounded-lg
        border border-border
      `, className)}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {open
          ? (
              <motion.div
                key="open"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeTransition}
                className="flex min-h-0 min-w-0 flex-1 flex-col"
                style={{ width }}
              >
                {children}
              </motion.div>
            )
          : (
              <motion.div
                key="strip"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeTransition}
                className="flex min-h-0 flex-1"
              >
                {strip}
              </motion.div>
            )}
      </AnimatePresence>
    </motion.section>
  );
};
