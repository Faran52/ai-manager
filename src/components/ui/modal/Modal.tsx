import {
  Dialog as DialogRoot,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { fadeTransition, riseTransition } from '../constants';

import type { FC, ReactNode } from 'react';

export interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  readonly widthClass?: string;
  readonly variant?: 'dialog' | 'sheet';
}

const VARIANTS: Record<NonNullable<ModalProps['variant']>, string> = {
  dialog: 'top-[12vh]',
  sheet: 'top-[8vh] flex h-[min(600px,78vh)] flex-col',
};

export const Modal: FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  widthClass = 'max-w-xl',
  variant = 'dialog',
}) => {
  return (
    // No trigger lives inside, so the only state Radix ever requests is closed.
    <DialogRoot open={open} onOpenChange={onClose}>
      {/*
        * forceMount hands presence to AnimatePresence, so the surface survives to
        * play its exit. Radix owns the focus trap, scroll lock, Escape and return.
        */}
      <AnimatePresence>
        {open && (
          <DialogPortal forceMount>
            <DialogOverlay asChild forceMount>
              <motion.div
                animate={{ opacity: 1 }}
                data-modal-backdrop
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                transition={fadeTransition}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              />
            </DialogOverlay>
            <DialogContent
              asChild
              forceMount
              // The description is the content itself, so a pointer at one node
              // would be a lie. Undefined removes Radix's own warning for it.
              aria-describedby={undefined}
            >
              <motion.div
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                data-modal-surface
                exit={{
                  opacity: 0,
                  y: '-0.75rem',
                  scale: 0.98,
                }}
                initial={{
                  opacity: 0,
                  y: '-0.75rem',
                  scale: 0.98,
                }}
                transition={riseTransition}
                className={cn(
                  `
                    fixed inset-s-1/2 z-50 w-full -translate-x-1/2
                    overflow-hidden rounded-lg border border-border bg-popover
                    shadow-2xl outline-none
                    rtl:translate-x-1/2
                  `,
                  VARIANTS[variant],
                  widthClass,
                )}
              >
                {/*
                  * A span, not the heading Radix renders by default: consumers
                  * draw their own, and two with the same text is one too many.
                  */}
                <DialogTitle asChild>
                  <span className="sr-only">{title}</span>
                </DialogTitle>
                {children}
              </motion.div>
            </DialogContent>
          </DialogPortal>
        )}
      </AnimatePresence>
    </DialogRoot>
  );
};
