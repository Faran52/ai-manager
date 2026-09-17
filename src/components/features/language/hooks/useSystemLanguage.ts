import { useEffect, useState } from 'react';
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

// Following the system is recorded by storing nothing. A stored language is a
// decision; its absence means the system should keep deciding, including later.
export const useSystemLanguage = (): SystemLanguageChoice => {
  const { i18n } = useTranslation();
  const [following, setFollowing] = useState(() => {
    return stored() == null;
  });

  /*
   * Another window of this app choosing a language writes the same key. Its
   * absence is the choice to follow the system, so a cleared key is followed
   * back to detection rather than treated as a language named ''.
   */
  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== languageStorageKey) {
        return;
      }

      setFollowing(event.newValue == null);
      void i18n.changeLanguage(event.newValue ?? undefined);
    };

    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, [i18n]);

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
