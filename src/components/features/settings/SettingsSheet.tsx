import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Info, Palette } from 'lucide-react';

import { appConfig } from '@config/appConfig';

import { cn } from '@utils/cnUtils';

import { Modal } from '@ui/index';
import { LanguagePicker } from '@features/language';
import {
  AccentPicker,
  FontSizePicker,
  ThemePicker,
} from '@features/theme';
import { UpdatePreference } from '@features/updates';

import { SettingRow } from './partials';

import type { ThemeMode } from '@features/theme';
import type { FC, ReactNode } from 'react';

export type SettingsPane = 'about' | 'appearance';

export interface SettingsSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly themeMode: ThemeMode;
  readonly onThemeChange: (mode: ThemeMode) => void;
}

interface Destination {
  readonly id: SettingsPane;
  readonly labelKey: string;
  readonly icon: ReactNode;
}

const PANES: readonly Destination[] = [
  {
    id: 'appearance',
    labelKey: 'settingsAppearance',
    icon: <Palette className="size-4" />,
  },
  {
    id: 'about',
    labelKey: 'settingsAbout',
    icon: <Info className="size-4" />,
  },
];

const ROW = `
  relative flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-ui
  text-foreground-2 transition-colors
  hover:text-foreground
  focus-visible:ring-2 focus-visible:ring-ring
`;

/**
 * Settings is a sheet over what you were doing rather than a fifth
 * destination: you come here to change one thing and leave, and the rail is
 * for the places you work.
 */
export const SettingsSheet: FC<SettingsSheetProps> = ({
  open,
  onClose,
  themeMode,
  onThemeChange,
}) => {
  const { t } = useTranslation('common');
  const [pane, setPane] = useState<SettingsPane>('appearance');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('navSettings')}
      variant="sheet"
      widthClass="max-w-4xl"
    >
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={t('navSettings')}
          data-settings-rail
          className="w-44 shrink-0 border-e border-border bg-background p-2"
        >
          {PANES.map((destination) => {
            const active = pane === destination.id;

            return (
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                data-settings-pane={destination.id}
                key={destination.id}
                onClick={() => {
                  setPane(destination.id);
                }}
                className={cn(ROW, active && `
                  bg-accent font-medium text-foreground
                `)}
              >
                <span className={active ? 'text-primary' : 'text-faint'}>
                  {destination.icon}
                </span>
                {t(destination.labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          {pane === 'appearance' && (
            <section>
              <h3 className="text-value font-semibold">{t('settingsAppearance')}</h3>
              <p className="mt-1 text-body text-muted-foreground">
                {t('settingsAppearanceIntro')}
              </p>
              <div className="mt-4">
                <SettingRow label={t('theme')} hint={t('themeHint')}>
                  <ThemePicker mode={themeMode} onChange={onThemeChange} />
                </SettingRow>
                <SettingRow label={t('accent')} hint={t('accentHint')}>
                  <AccentPicker />
                </SettingRow>
                <SettingRow label={t('textSize')} hint={t('textSizeHint')}>
                  <FontSizePicker />
                </SettingRow>
                <SettingRow label={t('language')} hint={t('languageHint')}>
                  <LanguagePicker />
                </SettingRow>
              </div>
            </section>
          )}

          {pane === 'about' && (
            <section>
              <h3 className="text-value font-semibold">{t('settingsAbout')}</h3>
              <p className="mt-1 text-body text-muted-foreground">{t('settingsAboutIntro')}</p>
              <div className="mt-4">
                <SettingRow label={t('settingsVersion')} hint={appConfig.version}>
                  <span />
                </SettingRow>
                <SettingRow label={t('settingsUpdates')} hint={t('settingsUpdatesHint')}>
                  <UpdatePreference />
                </SettingRow>
              </div>
            </section>
          )}
        </div>
      </div>
    </Modal>
  );
};
