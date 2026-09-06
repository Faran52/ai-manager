import { useTranslation } from 'react-i18next';

import { SegmentedControl } from '@ui/index';

import type { FC } from 'react';
import type { ThemeMode } from './hooks/useTheme';

export interface ThemePickerProps {
  readonly mode: ThemeMode;
  readonly onChange: (mode: ThemeMode) => void;
}

const ORDER: readonly ThemeMode[] = ['light', 'dark', 'system'];

// Keys, not text, the map lives outside the component where t is unavailable.
const LABEL_KEYS: Record<ThemeMode, string> = {
  light: 'themeLight',
  dark: 'themeDark',
  system: 'themeSystem',
};

export const ThemePicker: FC<ThemePickerProps> = ({ mode, onChange }) => {
  const { t } = useTranslation('common');

  return (
    <SegmentedControl
      label={t('theme')}
      value={mode}
      options={ORDER.map((option) => {
        return {
          value: option,
          label: t(LABEL_KEYS[option]),
        };
      })}
      onChange={onChange}
    />
  );
};
