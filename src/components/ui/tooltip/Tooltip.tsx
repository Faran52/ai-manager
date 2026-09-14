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
import { type PopupPosition } from '../menu/Menu';

import type {
  CSSProperties,
  FC,
  ReactNode,
} from 'react';

export interface TooltipProps {
  readonly content: string;
  readonly children: ReactNode;
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * A cell/cursor point rather than `children` itself. Lets one Tooltip serve
   * many hover targets (a heatmap's cells) instead of mounting one
   * Provider+Root+Portal per target; same technique as Menu's own `position`.
   * The caller drives `open` from its own pointer handlers.
   */
  readonly position?: PopupPosition;
  // Forces the open state. A position-anchored caller drives this itself,
  // since hover on the real cell never reaches the invisible trigger.
  readonly open?: boolean;
}

const DELAY_MS = MOTION_DURATION_BASE * 1000;

export const Tooltip: FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  position,
  open: openProp,
}) => {
  /*
   * Open state is held here only so AnimatePresence can play the exit; Radix
   * would otherwise unmount the content the moment the pointer leaves.
   */
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = openProp ?? uncontrolled;

  /*
   * A point has no element to hang off, so the trigger becomes an invisible one
   * parked at it, exactly like Menu's right-click anchor.
   */
  const anchor: CSSProperties | undefined = position == null
    ? undefined
    : {
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: 0,
        height: 0,
      };

  /*
   * The provider is per tooltip rather than at a root because Astro islands are
   * separate React trees, so there is no single root to hang one from. The cost
   * is that tooltips do not share a skip-delay window.
   */
  return (
    <TooltipProvider delayDuration={DELAY_MS}>
      <TooltipRoot open={open} onOpenChange={setUncontrolled}>
        <TooltipTrigger asChild={position == null} style={anchor}>
          {position == null ? children : <span aria-hidden />}
        </TooltipTrigger>
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
