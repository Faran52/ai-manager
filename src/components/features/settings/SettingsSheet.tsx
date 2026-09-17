import { useTranslation } from 'react-i18next';

import { Modal } from '@ui/index';

import { SettingsPanes } from './SettingsPanes';

import type { ThemeMode } from '@features/theme';
import type { FC } from 'react';

export interface SettingsSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly themeMode: ThemeMode;
  readonly onThemeChange: (mode: ThemeMode) => void;
}

// A sheet over what you were doing rather than a fifth destination on the rail.
// Where the platform gives Settings a window, it opens there instead.
export const SettingsSheet: FC<SettingsSheetProps> = ({
  open,
  onClose,
  themeMode,
  onThemeChange,
}) => {
  const { t } = useTranslation('common');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('navSettings')}
      variant="sheet"
      widthClass="max-w-4xl"
    >
      <SettingsPanes themeMode={themeMode} onThemeChange={onThemeChange} />
    </Modal>
  );
};
