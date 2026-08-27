import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Check, Palette } from 'lucide-react';

import {
  Button,
  MenuItem,
  PopupMenu,
} from '@ui/index';

import { accentNames, useAccent } from './useAccent';

import type { FC } from 'react';
import type { AccentName } from './useAccent';

// Keys, not text, the map lives outside the component where t is unavailable.
const LABEL_KEYS: Record<AccentName, string> = {
  teal: 'accentTeal',
  iris: 'accentIris',
  amber: 'accentAmber',
  rose: 'accentRose',
  lime: 'accentLime',
  sky: 'accentSky',
};

export const AccentPicker: FC = () => {
  const { t } = useTranslation('common');
  const { accent, setAccent } = useAccent();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        title={t('accentChange')}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <Palette className="size-3.5" />
      </Button>
      <PopupMenu
        open={open}
        align="right"
        label={t('accent')}
        onClose={() => {
          setOpen(false);
        }}
      >
        {accentNames.map((name) => {
          return (
            <MenuItem
              key={name}
              icon={(
                <span
                  data-accent={name}
                  className="size-3 rounded-full bg-primary ring-1 ring-border"
                />
              )}
              onClick={() => {
                setAccent(name);
                setOpen(false);
              }}
            >
              <span className="flex w-full items-center justify-between gap-3">
                {t(LABEL_KEYS[name])}
                {name === accent && <Check className="size-3.5 text-primary" />}
              </span>
            </MenuItem>
          );
        })}
      </PopupMenu>
    </div>
  );
};
