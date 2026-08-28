import { useCallback, useSyncExternalStore } from 'react';

import { fontSizeStorageKey } from '@config/storageKeys';

export type FontSize = 'compact' | 'normal' | 'large';

interface FontSizeState {
  readonly fontSize: FontSize;
  readonly setFontSize: (size: FontSize) => void;
}

export const fontSizes: readonly FontSize[] = ['compact', 'normal', 'large'];

const isFontSize = (value: string | null): value is FontSize => {
  return fontSizes.some((size) => {
    return size === value;
  });
};

const readStoredFontSize = (): FontSize => {
  const stored = localStorage.getItem(fontSizeStorageKey);

  return isFontSize(stored) ? stored : 'normal';
};

const applyDocumentFontSize = (size: FontSize): void => {
  document.documentElement.dataset.fontSize = size;
};

const listeners = new Set<() => void>();

const subscribe = (notify: () => void): (() => void) => {
  listeners.add(notify);

  return () => {
    listeners.delete(notify);
  };
};

export const useFontSize = (): FontSizeState => {
  const fontSize = useSyncExternalStore(subscribe, readStoredFontSize);

  const setFontSize = useCallback((next: FontSize) => {
    localStorage.setItem(fontSizeStorageKey, next);
    applyDocumentFontSize(next);

    for (const notify of listeners) {
      notify();
    }
  }, []);

  return {
    fontSize,
    setFontSize,
  };
};
