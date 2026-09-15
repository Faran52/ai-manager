import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { SessionListRow } from './SessionListRow';

import type { Transition } from 'motion/react';
import type { FC } from 'react';
import type { SessionRow } from '../utils/sessionThreadUtils';
import type { SessionRowContext } from './SessionListRow';

export interface SessionThreadGroupProps {
  readonly head: SessionRow;
  readonly parts: readonly SessionRow[];
  readonly context: SessionRowContext;
  // The disclosure timing, already reduced to instant for a reduced-motion reader.
  readonly collapse: Transition;
}

/**
 * One card around a thread's fullest transcript and the parts revealed by
 * expanding it: a part reads as belonging to the thread, not as a row that
 * happens to sit under the one above it. The `<ul>` and its head row stay
 * mounted whether or not it is open, so the group animates into and out of
 * a stable parent instead of cutting between two shapes.
 *
 * One motion element gated by the open boolean, exactly Disclosure's own
 * shape, rather than one per part: AnimatePresence animating a list that
 * starts genuinely empty does not reliably play an enter transition the
 * first time it gains children, only on every diff after that.
 */
export const SessionThreadGroup: FC<SessionThreadGroupProps> = ({
  head,
  parts,
  context,
  collapse,
}) => {
  const open = context.expandedThreads.includes(head.threadKey);

  return (
    <li className={cn(open && 'sidebar-thread-group')}>
      <ul>
        <SessionListRow row={head} continuation={false} context={context} />
        <AnimatePresence initial={false}>
          {open && (
            <motion.li
              key="parts"
              initial={{
                height: 0,
                opacity: 0,
              }}
              animate={{
                height: 'auto',
                opacity: 1,
              }}
              exit={{
                height: 0,
                opacity: 0,
              }}
              transition={collapse}
              className="overflow-hidden"
            >
              <ul>
                {parts.map((row) => {
                  return (
                    <SessionListRow
                      key={row.session.filePath}
                      row={row}
                      continuation
                      context={context}
                    />
                  );
                })}
              </ul>
            </motion.li>
          )}
        </AnimatePresence>
      </ul>
    </li>
  );
};
