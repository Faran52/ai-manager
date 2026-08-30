import { useTranslation } from 'react-i18next';

import { Button } from '../button/Button';
import { Modal } from '../modal/Modal';

import type { FC, ReactNode } from 'react';

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly labelledBy: string;
  readonly icon: ReactNode;
  readonly heading: string;
  readonly description: ReactNode;
  readonly confirmLabel: string;
  readonly busyLabel?: string | undefined;
  readonly busy?: boolean | undefined;
  readonly onClose: () => void;
  readonly onConfirm?: (() => void)
    | undefined;
}

export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  open,
  labelledBy,
  icon,
  heading,
  description,
  confirmLabel,
  busyLabel,
  busy = false,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation('common');
  return (
    <Modal open={open} onClose={onClose} labelledBy={labelledBy} widthClass="max-w-md">
      <div className="p-5">
        <h2
          id={labelledBy}
          className="flex items-center gap-2 text-base font-semibold"
        >
          {icon}
          {heading}
        </h2>
        {description}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={onClose}>{t('cancel')}</Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy && busyLabel != null ? busyLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
