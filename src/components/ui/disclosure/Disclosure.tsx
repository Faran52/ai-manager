import { useState } from 'react';

import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { collapseTransition } from '../constants';
import { useReducedMotion } from '../hooks/useReducedMotion';

import type { FC, ReactNode } from 'react';

export interface DisclosureProps {
  // Rendered inside the trigger button, so it may not hold its own interactive
  // elements. The chevron is appended after it.
  readonly summary: ReactNode;
  readonly children: ReactNode;
  // Controlled when set. Left uncontrolled a click flips its own state; the
  // errored tool card drives it so it can also restyle its border on open.
  readonly open?: boolean | undefined;
  readonly defaultOpen?: boolean | undefined;
  readonly onOpenChange?: ((open: boolean) => void)
    | undefined;
  readonly triggerClassName?: string | undefined;
  readonly className?: string | undefined;
}

/**
 * A reduced-motion reader gets the end state with no travel. Motion drives the
 * height through rAF, so the global prefers-reduced-motion CSS rule cannot reach
 * it: the duration has to be zeroed here.
 */
const INSTANT = { duration: 0 };

// Height is the one layout property the motion rules allow. Zero bounce so the
// rows below slide rather than wobble.
export const Disclosure: FC<DisclosureProps> = ({
  summary,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  triggerClassName,
  className,
}) => {
  const [selfOpen, setSelfOpen] = useState(defaultOpen);
  const reduceMotion = useReducedMotion();
  const controlled = open != null;
  const isOpen = controlled ? open : selfOpen;

  const toggle = (): void => {
    if (!controlled) {
      setSelfOpen(!isOpen);
    }

    onOpenChange?.(!isOpen);
  };

  return (
    <div data-disclosure data-state={isOpen ? 'open' : 'closed'} className={className}>
      <button
        type="button"
        aria-expanded={isOpen}
        data-state={isOpen ? 'open' : 'closed'}
        onClick={toggle}
        className={cn(
          `
            flex w-full items-center text-start
            focus-visible:ring-2 focus-visible:ring-ring
            focus-visible:outline-none
          `,
          triggerClassName,
        )}
      >
        {summary}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            `
              ms-auto size-3.5 shrink-0 text-muted-foreground
              transition-transform
            `,
            isOpen && 'rotate-180',
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="disclosure-content"
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
            transition={reduceMotion ? INSTANT : collapseTransition}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
