import { useSyncExternalStore } from 'react';

import { accentStorageKey } from '@config/storageKeys';

import { storedSetting } from '@utils/storedSettingUtils';

export type AccentName = 'teal' | 'iris' | 'amber' | 'rose' | 'lime' | 'sky';

/*
 * One of the six names that ship, or a hex the reader picked from the OS. The
 * two are not distinguishable in the type, so isAccentName is what tells them
 * apart at the point it matters.
 */
interface AccentState {
  readonly accent: string;
  readonly setAccent: (accent: string) => void;
}

export const accentNames: readonly AccentName[] = ['teal', 'iris', 'amber', 'rose', 'lime', 'sky'];

export const DEFAULT_CUSTOM_ACCENT = '#2f9e8f';

export const isAccentName = (value: string | null): value is AccentName => {
  return accentNames.some((name) => {
    return name === value;
  });
};

/*
 * Only the six-digit form. `<input type="color">` emits nothing else, and a
 * looser test would let a stored value through that the boot script then writes
 * straight into --primary.
 */
const isCustomAccent = (value: string | null): value is string => {
  return value != null && /^#[0-9a-f]{6}$/i.test(value);
};

const readStoredAccent = (): string => {
  const stored = localStorage.getItem(accentStorageKey);

  if (isAccentName(stored) || isCustomAccent(stored)) {
    return stored;
  }

  return 'teal';
};

const applyDocumentAccent = (accent: string): void => {
  if (isAccentName(accent)) {
    document.documentElement.dataset.accent = accent;
    // Or the last custom colour would outrank the named one just chosen.
    document.documentElement.style.removeProperty('--primary');

    return;
  }

  document.documentElement.dataset.accent = 'custom';
  document.documentElement.style.setProperty('--primary', accent);
};

const store = storedSetting(accentStorageKey, readStoredAccent, applyDocumentAccent);

export const useAccent = (): AccentState => {
  const accent = useSyncExternalStore(store.subscribe, store.read);

  return {
    accent,
    setAccent: store.write,
  };
};
