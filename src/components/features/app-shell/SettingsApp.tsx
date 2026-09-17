import { initI18n } from '@i18n/index';

import { SettingsPanes } from '@features/settings';
import { useTheme } from '@features/theme';

import type { FC } from 'react';

initI18n();

/*
 * The whole of the Settings window. It shares no memory with the window that
 * opened it, so it reads the preferences for itself; what it writes reaches
 * the other window through storage, which is why they stay in step.
 */
export const SettingsApp: FC = () => {
  const theme = useTheme();

  return (
    <main className="flex h-dvh bg-popover text-foreground" data-settings-window>
      <SettingsPanes themeMode={theme.mode} onThemeChange={theme.setMode} />
    </main>
  );
};
