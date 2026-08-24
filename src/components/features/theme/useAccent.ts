import { useCallback, useSyncExternalStore } from 'react';

import { accentStorageKey } from '@config/storageKeys';

export type AccentName = 'teal' | 'iris' | 'amber' | 'rose' | 'lime' | 'sky';

interface AccentState {
  readonly accent: AccentName;
  readonly setAccent: (accent: AccentName) => void;
}

export const accentNames: readonly AccentName[] = ['teal', 'iris', 'amber', 'rose', 'lime', 'sky'];

const isAccentName = (value: string | null): value is AccentName => {
  return accentNames.some((name) => {
    return name === value;
  });
};

const readStoredAccent = (): AccentName => {
  const stored = localStorage.getItem(accentStorageKey);

  return isAccentName(stored) ? stored : 'teal';
};

const applyDocumentAccent = (accent: AccentName): void => {
  document.documentElement.dataset.accent = accent;
};

const listeners = new Set<() => void>();

const subscribe = (notify: () => void): (() => void) => {
  listeners.add(notify);

  return () => {
    listeners.delete(notify);
  };
};

export const useAccent = (): AccentState => {
  const accent = useSyncExternalStore(subscribe, readStoredAccent);

  const setAccent = useCallback((next: AccentName) => {
    localStorage.setItem(accentStorageKey, next);
    applyDocumentAccent(next);

    for (const notify of listeners) {
      notify();
    }
  }, []);

  return {
    accent,
    setAccent,
  };
};
