import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { fadeTransition, riseTransition } from './constants';

import type { FC, ReactNode } from 'react';

export interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly labelledBy: string;
  readonly children: ReactNode;
  readonly widthClass?: string;
}

export const Modal: FC<ModalProps> = ({
  open,
  onClose,
  labelledBy,
  children,
  widthClass = 'max-w-xl',
}) => {
  const { t } = useTranslation('common');
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Depends on `open` alone. Callers pass an inline `onClose`, so depending on it would rerun
  // this on every parent render and pull focus off whatever the user was typing into.
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    surfaceRef.current?.focus();

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeRef.current();
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fadeTransition}
          className="
            fixed inset-0 z-50 flex items-start justify-center bg-black/40
            pt-[12vh] backdrop-blur-sm
          "
          data-modal-backdrop
        >
          <button
            type="button"
            aria-label={t('closeDialog')}
            onClick={onClose}
            className="absolute inset-0 cursor-default"
          />
          <motion.div
            ref={surfaceRef}
            initial={{
              opacity: 0,
              y: '-0.75rem',
              scale: 0.98,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: '-0.75rem',
              scale: 0.98,
            }}
            transition={riseTransition}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            data-modal-surface
            className={cn(
              `
                relative z-10 w-full overflow-hidden rounded-xl border
                border-border bg-popover shadow-2xl outline-none
              `,
              widthClass,
            )}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
