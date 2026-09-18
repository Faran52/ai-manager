import { useTranslation } from 'react-i18next';

import { Modal } from '@ui/index';

import { AboutPanel } from './AboutPanel';

import type { ProbeStage } from '@features/updates';
import type { FC } from 'react';

export interface AboutDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly stage: ProbeStage;
  readonly version: string | undefined;
  readonly onCheck?: (() => void)
    | undefined;
}

/*
 * About where the platform draws no window for it: Windows, Linux, a browser.
 * macOS opens the same panel in a window instead. The Modal draws no padding and
 * hides its title, so the surface and the heading are this component's.
 */
export const AboutDialog: FC<AboutDialogProps> = ({
  open,
  onClose,
  stage,
  version,
  onCheck,
}) => {
  const { t } = useTranslation('common');

  return (
    <Modal open={open} onClose={onClose} title={t('settingsAbout')} widthClass="max-w-xs">
      <div className="p-5">
        <AboutPanel stage={stage} version={version} onCheck={onCheck} />
      </div>
    </Modal>
  );
};
