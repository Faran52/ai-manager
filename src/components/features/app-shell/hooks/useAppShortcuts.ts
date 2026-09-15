import { useEffect, useState } from 'react';

import { appShortcuts } from '@config/shortcuts';

import { isTypingTarget, matchesShortcut } from '@utils/shortcutUtils';

import type { ShortcutSpec } from '@config/shortcuts';
import type { AppView } from '@features/app-header';

export interface AppShortcuts {
  readonly searchOpen: boolean;
  readonly setSearchOpen: (open: boolean) => void;
  readonly settingsOpen: boolean;
  readonly setSettingsOpen: (open: boolean) => void;
  readonly shortcutsOpen: boolean;
  readonly setShortcutsOpen: (open: boolean) => void;
}

/*
 * The global keys and the three dialogs they open. One listener for every
 * binding, so a shortcut is added by adding a row here and to `appShortcuts`
 * rather than by growing another effect.
 */
export const useAppShortcuts = (
  setView: (view: AppView) => void,
  reload: () => void,
): AppShortcuts => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const actions: readonly (readonly [ShortcutSpec, () => void])[] = [
      [appShortcuts.openSearch, () => {
        setSearchOpen(true);
      }],
      [appShortcuts.showShortcuts, () => {
        setShortcutsOpen(true);
      }],
      [appShortcuts.viewSessions, () => {
        setView('sessions');
      }],
      [appShortcuts.viewAnalytics, () => {
        setView('analytics');
      }],
      [appShortcuts.viewHealth, () => {
        setView('health');
      }],
      [appShortcuts.viewArchive, () => {
        setView('archive');
      }],
      [appShortcuts.viewSettings, () => {
        setSettingsOpen(true);
      }],
      [appShortcuts.reload, reload],
    ];

    const onKey = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) {
        return;
      }

      for (const [spec, run] of actions) {
        if (matchesShortcut(event, spec)) {
          event.preventDefault();
          run();

          return;
        }
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [reload, setView]);

  return {
    searchOpen,
    setSearchOpen,
    settingsOpen,
    setSettingsOpen,
    shortcutsOpen,
    setShortcutsOpen,
  };
};
