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

/*
 * The ul and head row stay mounted so parts animate into a stable parent. One
 * motion element, not one per part: AnimatePresence skips the first enter.
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
