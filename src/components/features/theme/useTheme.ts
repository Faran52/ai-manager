import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';

import { themeStorageKey } from '@config/storageKeys';

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

const resolveIsDark = (mode: Exclude<ThemeMode, 'system'>): boolean => {
  return mode === 'dark';
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

export const useTheme = (): ThemeState => {
  const [mode, setMode] = useState<ThemeMode>(readStoredMode);
  const systemDark = useSyncExternalStore(subscribeSystemTheme, prefersDark);
  const isDark = mode === 'system' ? systemDark : resolveIsDark(mode);

  useEffect(() => {
    applyDocumentTheme(isDark);
  }, [isDark]);

  const updateMode = useCallback((next: ThemeMode): void => {
    setMode(next);
    localStorage.setItem(themeStorageKey, next);
  }, []);

  return {
    mode,
    isDark,
    setMode: updateMode,
  };
};
