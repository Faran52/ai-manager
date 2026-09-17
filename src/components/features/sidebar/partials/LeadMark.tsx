import { Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { AgentMark, controlTransition } from '@ui/index';

import type { AgentId } from '@config/agents';
import type { FC } from 'react';

export interface LeadMarkProps {
  readonly agent: AgentId;
  readonly selecting: boolean;
  readonly checked: boolean;
  readonly reduceMotion: boolean;
}

// A reduced-motion reader gets the end state with no travel, same as Disclosure.
const INSTANT = { duration: 0 };

// The two faces of the leading gutter: a small pop in and out, cross-faded.
const MARK_SWAP = {
  initial: {
    opacity: 0,
    scale: 0.8,
  },
  animate: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.8,
  },
};

/*
 * Selection mode borrows a row's leading gutter for a checkbox, otherwise it
 * carries the agent circle. A fixed size-7 either way, so the two cross-fade in place.
 */
export const LeadMark: FC<LeadMarkProps> = ({
  agent,
  selecting,
  checked,
  reduceMotion,
}) => {
  const transition = reduceMotion ? INSTANT : controlTransition;

  return (
    <span className="flex size-7 shrink-0 items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        {selecting
          ? (
              <motion.span
                key="check"
                {...MARK_SWAP}
                transition={transition}
                className="sidebar-check"
                data-checked={checked}
                aria-hidden="true"
              >
                <Check className="size-3" strokeWidth={3} />
              </motion.span>
            )
          : (
              <motion.span
                key="mark"
                {...MARK_SWAP}
                transition={transition}
                className="flex"
              >
                <AgentMark agent={agent} className="size-7 text-figure" />
              </motion.span>
            )}
      </AnimatePresence>
    </span>
  );
};
