import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { labelOf, languages } from '@i18n/index';
import {
  Check,
  Languages,
  MonitorSmartphone,
} from 'lucide-react';

import {
  Button,
  MenuItem,
  PopupMenu,
} from '@ui/index';

import { useSystemLanguage } from './hooks/useSystemLanguage';

import type { FC } from 'react';

export const LanguagePicker: FC = () => {
  const { t, i18n } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const {
    following,
    follow,
    choose,
  } = useSystemLanguage();
  const activeLabel = following
    ? t('languageSystemNamed', { language: labelOf(i18n.language) })
    : labelOf(i18n.language);

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        title={`${t('language')}: ${activeLabel}`}
        aria-label={t('languageChange')}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <Languages className="size-3.5" />
      </Button>
      <PopupMenu
        open={open}
        align="right"
        label={t('language')}
        onClose={() => {
          setOpen(false);
        }}
      >
        <MenuItem
          icon={<MonitorSmartphone className="size-3.5" />}
          onClick={() => {
            follow();
            setOpen(false);
          }}
        >
          <span className="flex w-full items-center justify-between gap-3">
            {t('languageSystem')}
            {following && <Check className="size-3.5 text-primary" />}
          </span>
        </MenuItem>

        {languages.map((option) => {
          return (
            <MenuItem
              key={option.id}
              icon={<Languages className="size-3.5" />}
              onClick={() => {
                choose(option.id);
                setOpen(false);
              }}
            >
              <span className="flex w-full items-center justify-between gap-3">
                {option.label}
                {!following && option.id === i18n.language && (
                  <Check className="size-3.5 text-primary" />
                )}
              </span>
            </MenuItem>
          );
        })}
      </PopupMenu>
    </div>
  );
};
