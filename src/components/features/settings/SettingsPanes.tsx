import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Palette } from 'lucide-react';

import { cn } from '@utils/cnUtils';

import { LanguagePicker } from '@features/language';
import {
  AccentPicker,
  FontSizePicker,
  ThemePicker,
} from '@features/theme';

import { SettingRow } from './partials';

import type { ThemeMode } from '@features/theme';
import type { FC, ReactNode } from 'react';

export type SettingsPane = 'appearance';

export interface SettingsPanesProps {
  readonly themeMode: ThemeMode;
  readonly onThemeChange: (mode: ThemeMode) => void;
}

interface Destination {
  readonly id: SettingsPane;
  readonly labelKey: string;
  readonly icon: ReactNode;
}

/* One entry today. The rail stays because the next pane should be a row here
   rather than a re-layout of the sheet. */
const PANES: readonly Destination[] = [
  {
    id: 'appearance',
    labelKey: 'settingsAppearance',
    icon: <Palette className="size-4" />,
  },
];

const ROW = `
  relative flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-ui
  text-foreground-2 transition-colors
  hover:text-foreground
  focus-visible:ring-2 focus-visible:ring-ring
`;

/*
 * Settings without the surface around it: a sheet where the platform draws no
 * window and a window where it does, so it carries the rail, the panes, no frame.
 */
export const SettingsPanes: FC<SettingsPanesProps> = ({ themeMode, onThemeChange }) => {
  const { t } = useTranslation('common');
  /* Held by name rather than by the union, which has one member today: the
     open pane is a value here, not a fact the type already settled. */
  const [pane, setPane] = useState<string>('appearance');

  return (
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
              /* v8 ignore next -- one pane, so nothing is ever not current */
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
              <span
                /* v8 ignore next -- the same: no pane here is ever the quiet one */
                className={active ? 'text-primary' : 'text-faint'}
              >
                {destination.icon}
              </span>
              {t(destination.labelKey)}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto p-5">
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
      </div>
    </div>
  );
};
