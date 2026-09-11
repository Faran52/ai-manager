import { AnimatePresence, motion } from 'motion/react';

import { riseTransition } from '../constants';

import { Toast } from './Toast';

import type { FC } from 'react';
import type { ToastVariant } from './Toast';

export interface ActiveToast {
  readonly id: number;
  readonly text: string;
  readonly variant: ToastVariant;
}

export interface ToastStackProps {
  readonly toasts: readonly ActiveToast[];
  readonly onDismiss: (id: number) => void;
}

/*
 * Always mounted so the live region predates its first message, which screen
 * readers require. `layout` is what pushes an earlier toast down (or up, on
 * exit) when another arrives; each one still slides in from the trailing
 * edge on its own.
 */
export const ToastStack: FC<ToastStackProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{
                opacity: 0,
                x: '1rem',
              }}
              animate={{
                opacity: 1,
                x: 0,
              }}
              exit={{
                opacity: 0,
                x: '1rem',
              }}
              transition={riseTransition}
            >
              <Toast
                text={toast.text}
                variant={toast.variant}
                onClose={() => {
                  onDismiss(toast.id);
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
