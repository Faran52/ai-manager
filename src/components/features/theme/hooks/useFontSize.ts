import { useSyncExternalStore } from 'react';

import { fontSizeStorageKey } from '@config/storageKeys';

import { storedSetting } from '@utils/storedSettingUtils';

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

const store = storedSetting(fontSizeStorageKey, readStoredFontSize, applyDocumentFontSize);

export const useFontSize = (): FontSizeState => {
  const fontSize = useSyncExternalStore(store.subscribe, store.read);

  return {
    fontSize,
    setFontSize: store.write,
  };
};
