import { SearchDialog } from '@features/search';
import { SettingsSheet } from '@features/settings';

import { AboutDialog } from './AboutDialog';
import { ShortcutsDialog } from './ShortcutsDialog';

import type { useUpdateProbe } from '@features/updates';
import type { ComponentProps, FC } from 'react';
import type { useAppShortcuts } from '../hooks/useAppShortcuts';

export interface HistoryAppDialogsProps {
  readonly dialogs: ReturnType<typeof useAppShortcuts>;
  readonly aboutOpen: boolean;
  readonly onCloseAbout: () => void;
  readonly updateProbe: ReturnType<typeof useUpdateProbe>;
  readonly onCheckUpdate: ComponentProps<typeof AboutDialog>['onCheck'];
  readonly themeMode: ComponentProps<typeof SettingsSheet>['themeMode'];
  readonly onThemeChange: ComponentProps<typeof SettingsSheet>['onThemeChange'];
  readonly search: ComponentProps<typeof SearchDialog>['search'];
  readonly projectNames: ComponentProps<typeof SearchDialog>['projectNames'];
  readonly onJump: ComponentProps<typeof SearchDialog>['onJump'];
}

export const HistoryAppDialogs: FC<HistoryAppDialogsProps> = ({
  dialogs,
  aboutOpen,
  onCloseAbout,
  updateProbe,
  onCheckUpdate,
  themeMode,
  onThemeChange,
  search,
  projectNames,
  onJump,
}) => {
  const {
    shortcutsOpen,
    setShortcutsOpen,
    settingsOpen,
    setSettingsOpen,
    searchOpen,
    setSearchOpen,
  } = dialogs;

  return (
    <>
      <AboutDialog
        open={aboutOpen}
        stage={updateProbe.stage}
        version={updateProbe.version}
        onCheck={onCheckUpdate}
        onClose={onCloseAbout}
      />

      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => {
          setShortcutsOpen(false);
        }}
      />

      <SettingsSheet
        open={settingsOpen}
        themeMode={themeMode}
        onClose={() => {
          setSettingsOpen(false);
        }}
        onThemeChange={onThemeChange}
      />

      <SearchDialog
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false);
        }}
        search={search}
        projectNames={projectNames}
        onJump={onJump}
      />
    </>
  );
};
