import { useCallback, useSyncExternalStore } from 'react';

import { updateCheckStorageKey } from '@config/storageKeys';

export type UpdateCheck = 'launch' | 'never';

interface UpdateCheckState {
  readonly updateCheck: UpdateCheck;
  readonly setUpdateCheck: (value: UpdateCheck) => void;
}

export const updateChecks: readonly UpdateCheck[] = ['launch', 'never'];

const isUpdateCheck = (value: string | null): value is UpdateCheck => {
  return updateChecks.some((option) => {
    return option === value;
  });
};

// Checking is the default: a build that never looks cannot tell you it is stale.
const readStored = (): UpdateCheck => {
  const stored = localStorage.getItem(updateCheckStorageKey);

  return isUpdateCheck(stored) ? stored : 'launch';
};

const listeners = new Set<() => void>();

const subscribe = (notify: () => void): (() => void) => {
  listeners.add(notify);

  return () => {
    listeners.delete(notify);
  };
};

export const useUpdateCheck = (): UpdateCheckState => {
  const updateCheck = useSyncExternalStore(subscribe, readStored);

  const setUpdateCheck = useCallback((next: UpdateCheck) => {
    localStorage.setItem(updateCheckStorageKey, next);

    for (const notify of listeners) {
      notify();
    }
  }, []);

  return {
    updateCheck,
    setUpdateCheck,
  };
};
