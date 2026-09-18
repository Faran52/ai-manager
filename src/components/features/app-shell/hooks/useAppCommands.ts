import { useCallback, useState } from 'react';

import type { AppCommand } from '@config/appCommands';
import type { AppView } from '@features/app-header';
import type { Dispatch, SetStateAction } from 'react';

export interface AppCommandOptions {
  readonly setView: Dispatch<SetStateAction<AppView>>;
  readonly reloadProjects: () => void;
  readonly setSettingsOpen: (open: boolean) => void;
  readonly setShortcutsOpen: (open: boolean) => void;
}

export interface AppCommands {
  readonly runCommand: (command: AppCommand) => void;
  readonly aboutOpen: boolean;
  readonly closeAbout: () => void;
}

export const useAppCommands = (options: AppCommandOptions): AppCommands => {
  const {
    setView,
    reloadProjects,
    setSettingsOpen,
    setShortcutsOpen,
  } = options;
  const [aboutOpen, setAboutOpen] = useState(false);

  /*
   * A window where the platform draws one, the dialog or sheet everywhere else.
   * That window outlives this one, so nothing here waits on it.
   */
  const runCommand = useCallback((command: AppCommand): void => {
    const actions: Record<AppCommand, () => void> = {
      about: () => {
        const openAbout = window.bindings?.openAbout;

        if (openAbout == null) {
          setAboutOpen(true);

          return;
        }

        void openAbout();
      },
      settings: () => {
        const openSettings = window.bindings?.openSettings;

        if (openSettings == null) {
          setSettingsOpen(true);

          return;
        }

        void openSettings();
      },
      viewSessions: () => {
        setView('sessions');
      },
      viewAnalytics: () => {
        setView('analytics');
      },
      viewHealth: () => {
        setView('health');
      },
      viewArchive: () => {
        setView('archive');
      },
      reload: reloadProjects,
      showShortcuts: () => {
        setShortcutsOpen(true);
      },
    };

    actions[command]();
  }, [reloadProjects, setSettingsOpen, setShortcutsOpen, setView]);

  const closeAbout = useCallback(() => {
    setAboutOpen(false);
  }, []);

  return {
    runCommand,
    aboutOpen,
    closeAbout,
  };
};
