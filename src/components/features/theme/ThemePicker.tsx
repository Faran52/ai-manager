import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Check,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react';

import {
  Button,
  MenuItem,
  PopupMenu,
} from '@ui/index';

import type { FC, ReactNode } from 'react';
import type { ThemeMode } from './hooks/useTheme';

export interface ThemePickerProps {
  readonly mode: ThemeMode;
  readonly onChange: (mode: ThemeMode) => void;
}

const ORDER: readonly ThemeMode[] = ['light', 'dark', 'system'];

// Keys, not text, the map lives outside the component where t is unavailable.
const DETAIL: Record<ThemeMode, { readonly label: string;
  readonly icon: ReactNode; }> = {
  light: {
    label: 'themeLight',
    icon: <Sun className="size-3.5" />,
  },
  dark: {
    label: 'themeDark',
    icon: <Moon className="size-3.5" />,
  },
  system: {
    label: 'themeSystem',
    icon: <Monitor className="size-3.5" />,
  },
};

export const ThemePicker: FC<ThemePickerProps> = ({ mode, onChange }) => {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const active = DETAIL[mode];

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        title={`${t('theme')}: ${t(active.label)}`}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {active.icon}
      </Button>
      <PopupMenu
        open={open}
        align="right"
        label={t('theme')}
        onClose={() => {
          setOpen(false);
        }}
      >
        {ORDER.map((option) => {
          return (
            <MenuItem
              key={option}
              icon={DETAIL[option].icon}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              <span className="flex w-full items-center justify-between gap-3">
                {t(DETAIL[option].label)}
                {option === mode && <Check className="size-3.5 text-primary" />}
              </span>
            </MenuItem>
          );
        })}
      </PopupMenu>
    </div>
  );
};
