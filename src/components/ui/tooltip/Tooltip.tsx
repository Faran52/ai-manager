import { useState } from 'react';

import {
  Tooltip as TooltipRoot,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
} from '@radix-ui/react-tooltip';
import { AnimatePresence, motion } from 'motion/react';

import { MOTION_DURATION_BASE, popoverTransition } from '../constants';

import type { FC, ReactNode } from 'react';

export interface TooltipProps {
  readonly content: string;
  readonly children: ReactNode;
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
}

const DELAY_MS = MOTION_DURATION_BASE * 1000;

export const Tooltip: FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
}) => {
  /*
   * Open state is held here only so AnimatePresence can play the exit; Radix
   * would otherwise unmount the content the moment the pointer leaves.
   */
  const [open, setOpen] = useState(false);

  /*
   * The provider is per tooltip rather than at a root because Astro islands are
   * separate React trees, so there is no single root to hang one from. The cost
   * is that tooltips do not share a skip-delay window.
   */
  return (
    <TooltipProvider delayDuration={DELAY_MS}>
      <TooltipRoot open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <AnimatePresence>
          {open && (
            <TooltipPortal forceMount>
              <TooltipContent asChild forceMount side={side} sideOffset={6}>
                {/*
                  * Opacity and scale only. Radix positions this with its own
                  * transform, and a y offset here would fight it.
                  */}
                <motion.div
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.96,
                  }}
                  initial={{
                    opacity: 0,
                    scale: 0.96,
                  }}
                  transition={popoverTransition}
                  className="
                    z-50 rounded-md border border-border bg-popover px-2 py-1
                    text-xs text-foreground shadow-md
                  "
                >
                  {content}
                </motion.div>
              </TooltipContent>
            </TooltipPortal>
          )}
        </AnimatePresence>
      </TooltipRoot>
    </TooltipProvider>
  );
};
