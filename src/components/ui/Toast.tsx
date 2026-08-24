import { AnimatePresence, motion } from 'motion/react';

import { riseTransition } from './motionTokens';

import type { FC } from 'react';

export interface ToastProps {
  readonly message: string | null;
}

// Always mounted so the live region predates its message, which screen readers require.
export const Toast: FC<ToastProps> = ({ message }) => {
  return (
    <div role="status" aria-live="polite">
      <AnimatePresence>
        {message != null && (
          <motion.div
            key={message}
            initial={{
              opacity: 0,
              y: '-0.35rem',
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: '-0.35rem',
            }}
            transition={riseTransition}
            className="toast"
            data-toast
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
