import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { languageStorageKey } from '@config/storageKeys';

export interface SystemLanguageChoice {
  // True while no language has been chosen, so the system's own decides.
  readonly following: boolean;
  readonly follow: () => void;
  readonly choose: (language: string) => void;
}

const stored = (): string | null => {
  try {
    return globalThis.localStorage.getItem(languageStorageKey);
  }
  /* v8 ignore next 3 -- storage can be barred outright by browser settings */
  catch {
    return null;
  }
};

const forget = (): void => {
  try {
    globalThis.localStorage.removeItem(languageStorageKey);
  }
  /* v8 ignore next 2 -- storage can be barred outright by browser settings */
  catch {
    // Nothing was stored, so there is nothing to put right.
  }
};

const remember = (language: string): void => {
  try {
    globalThis.localStorage.setItem(languageStorageKey, language);
  }
  /* v8 ignore next 2 -- storage can be barred outright by browser settings */
  catch {
    // The choice still applies to this visit; it just will not outlive it.
  }
};

/**
 * Following the system is recorded by storing nothing, rather than by storing
 * the word "system". A stored language is a decision the reader made; its
 * absence means they never made one, which is exactly when their system should
 * be allowed to keep deciding, including after it changes.
 */
export const useSystemLanguage = (): SystemLanguageChoice => {
  const { i18n } = useTranslation();
  const [following, setFollowing] = useState(() => {
    return stored() == null;
  });

  return {
    following,
    follow: () => {
      forget();
      setFollowing(true);
      // Detection runs again, and with nothing stored it reaches the system.
      void i18n.changeLanguage();
    },
    choose: (language: string) => {
      remember(language);
      setFollowing(false);
      void i18n.changeLanguage(language);
    },
  };
};
