import { useEffect, useRef } from 'react';

import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { popoverTransition } from './motionTokens';

import type { MotionStyle } from 'motion/react';
import type { FC, ReactNode } from 'react';

export interface PopupPosition {
  readonly x: number;
  readonly y: number;
}

export interface PopupMenuProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly position?: PopupPosition;
  readonly align?: 'left' | 'right';
  readonly label: string;
}

export const PopupMenu: FC<PopupMenuProps> = ({
  open,
  onClose,
  children,
  position,
  align = 'right',
  label,
}) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  /**
   * Dismissal listens on `click`, not `pointerdown`: a trigger that toggles on click
   * would otherwise be reopened by its own click after pointerdown had closed the menu.
   * Depends on `open` alone because callers pass inline `onClose` closures, and
   * re-subscribing five window listeners on every parent render churns event delivery.
   */
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const closeOutside = (event: Event): void => {
      if (event.target instanceof Node && !surfaceRef.current?.contains(event.target)) {
        closeRef.current();
      }
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeRef.current();
      }
    };

    window.addEventListener('click', closeOutside);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('blur', closeRef.current);
    window.addEventListener('resize', closeRef.current);
    document.addEventListener('scroll', closeOutside, true);

    return () => {
      window.removeEventListener('click', closeOutside);
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('blur', closeRef.current);
      window.removeEventListener('resize', closeRef.current);
      document.removeEventListener('scroll', closeOutside, true);
    };
  }, [open]);

  const style: MotionStyle = position == null
    ? {}
    : {
        left: `min(${String(position.x)}px, calc(100vw - 16rem))`,
        top: `min(${String(position.y)}px, calc(100vh - 12rem))`,
      };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={surfaceRef}
          role="menu"
          aria-label={label}
          style={style}
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
          className={cn(
            `
              z-50 w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl
              border border-border bg-popover p-1 shadow-2xl shadow-black/25
            `,
            position == null && 'absolute top-full mt-1.5',
            position == null && (align === 'left'
              ? 'inset-s-0 origin-top-left'
              : 'inset-e-0 origin-top-right'),
            position != null && 'fixed origin-top-left',
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
