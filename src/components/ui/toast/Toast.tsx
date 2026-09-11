import { useTranslation } from 'react-i18next';

import {
  CircleAlert,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react';

import type { FC, ReactNode } from 'react';

export type ToastVariant = 'info' | 'warning' | 'error';

export interface ToastProps {
  readonly text: string;
  readonly variant: ToastVariant;
  readonly onClose: () => void;
}

const ICONS: Record<ToastVariant, ReactNode> = {
  info: <Info className="size-4 shrink-0" />,
  warning: <TriangleAlert className="size-4 shrink-0" />,
  error: <CircleAlert className="size-4 shrink-0" />,
};

// One toast's own look: the stack around it owns position, order and motion.
export const Toast: FC<ToastProps> = ({
  text,
  variant,
  onClose,
}) => {
  const { t } = useTranslation('common');

  return (
    <div className="toast" data-toast data-variant={variant}>
      {ICONS[variant]}
      <span className="toast-message">{text}</span>
      <button
        type="button"
        className="toast-close"
        aria-label={t('closeToast')}
        onClick={onClose}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
};
