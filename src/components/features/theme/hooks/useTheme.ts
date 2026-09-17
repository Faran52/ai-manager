import { useEffect, useSyncExternalStore } from 'react';

import { themeStorageKey } from '@config/storageKeys';

import { storedSetting } from '@utils/storedSettingUtils';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  readonly mode: ThemeMode;
  readonly isDark: boolean;
  readonly setMode: (mode: ThemeMode) => void;
}

const readStoredMode = (): ThemeMode => {
  const stored = localStorage.getItem(themeStorageKey);

  return stored === 'light' || stored === 'dark' ? stored : 'system';
};

const prefersDark = (): boolean => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const applyDocumentTheme = (isDark: boolean): void => {
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
};

const subscribeSystemTheme = (notify: () => void): (() => void) => {
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  media.addEventListener('change', notify);

  return () => {
    media.removeEventListener('change', notify);
  };
};

/* No apply of its own: what the document shows is the mode resolved against
   the system preference, which the effect below owns. */
const store = storedSetting(themeStorageKey, readStoredMode);

export const useTheme = (): ThemeState => {
  const mode = useSyncExternalStore(store.subscribe, store.read);
  const systemDark = useSyncExternalStore(subscribeSystemTheme, prefersDark);
  const isDark = mode === 'system' ? systemDark : mode === 'dark';

  useEffect(() => {
    applyDocumentTheme(isDark);
  }, [isDark]);

  return {
    mode,
    isDark,
    setMode: store.write,
  };
};
