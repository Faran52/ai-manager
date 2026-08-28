import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ALargeSmall, Check } from 'lucide-react';

import {
  Button,
  MenuItem,
  PopupMenu,
} from '@ui/index';

import { fontSizes, useFontSize } from './hooks/useFontSize';

import type { FC } from 'react';
import type { FontSize } from './hooks/useFontSize';

// Keys, not text, the map lives outside the component where t is unavailable.
const LABEL_KEYS: Record<FontSize, string> = {
  compact: 'textSizeCompact',
  normal: 'textSizeNormal',
  large: 'textSizeLarge',
};

const SAMPLE_CLASSES: Record<FontSize, string> = {
  compact: 'text-[11px]',
  normal: 'text-[13px]',
  large: 'text-[15px]',
};

export const FontSizePicker: FC = () => {
  const { t } = useTranslation('common');
  const { fontSize, setFontSize } = useFontSize();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        title={t('textSizeChange')}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <ALargeSmall className="size-3.5" />
      </Button>
      <PopupMenu
        open={open}
        align="right"
        label={t('textSize')}
        onClose={() => {
          setOpen(false);
        }}
      >
        {fontSizes.map((size) => {
          return (
            <MenuItem
              key={size}
              icon={<span className={SAMPLE_CLASSES[size]}>Aa</span>}
              onClick={() => {
                setFontSize(size);
                setOpen(false);
              }}
            >
              <span className="flex w-full items-center justify-between gap-3">
                {t(LABEL_KEYS[size])}
                {size === fontSize && <Check className="size-3.5 text-primary" />}
              </span>
            </MenuItem>
          );
        })}
      </PopupMenu>
    </div>
  );
};
