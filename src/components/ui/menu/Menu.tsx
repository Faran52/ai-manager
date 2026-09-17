import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { popoverTransition } from '../constants';

import type {
  CSSProperties,
  FC,
  ReactNode,
} from 'react';

export interface PopupPosition {
  readonly x: number;
  readonly y: number;
}

export interface MenuProps {
  readonly trigger: ReactNode;
  readonly label: string;
  readonly children: ReactNode;
  readonly align?: 'start' | 'end';
  // Radix anchors to its trigger, so a right-click menu gets a zero-sized one
  // parked at the cursor: positioning, collision flipping and focus stay Radix's.
  readonly position?: PopupPosition;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

export const MENU_SURFACE = `
  z-50 min-w-56 max-w-[calc(100vw-1rem)] rounded-lg border border-raised
  bg-popover p-1 shadow-2xl shadow-black/25
`;

export const Menu: FC<MenuProps> = ({
  trigger,
  label,
  children,
  align = 'end',
  position,
  open,
  onOpenChange,
}) => {
  const [uncontrolled, setUncontrolled] = useState(false);
  const isOpen = open ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  /*
   * A point has no element to hang off, so the trigger becomes an invisible one
   * parked at it. Without that Radix anchors the menu at the document origin.
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

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild={position == null} style={anchor}>
        {trigger}
      </DropdownMenuTrigger>
      <AnimatePresence>
        {isOpen && (
          // A stable key so a fast open/close/open reads as one element entering. Without
          // it AnimatePresence can leave the content stuck at its exit opacity.
          <DropdownMenuPortal key="menu" forceMount>
            <DropdownMenuContent
              asChild
              align={position == null ? align : 'start'}
              sideOffset={position == null ? 6 : 0}
              aria-label={label}
              /*
               * Radix names the menu after its trigger, which here is an invisible
               * point. An explicit label only wins once that pointer is cleared.
               */
              aria-labelledby={undefined}
            >
              <motion.div
                className={cn(MENU_SURFACE)}
                initial={{
                  opacity: 0,
                  y: '-0.25rem',
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  y: '-0.125rem',
                }}
                transition={popoverTransition}
              >
                {children}
              </motion.div>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        )}
      </AnimatePresence>
    </DropdownMenu>
  );
};
