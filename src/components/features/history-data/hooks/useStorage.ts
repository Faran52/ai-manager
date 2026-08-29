import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { fetchStorage } from '@lib/apis/apiClient';

import { runLoad } from '../utils/asyncResourceUtils';

import type { StorageReport } from '@services/storage/storageService';
import type { AsyncResource, AsyncSnapshot } from '../utils/asyncResourceUtils';

export const useStorage = (enabled: boolean): AsyncResource<StorageReport> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<StorageReport>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let active = true;

    void runLoad(fetchStorage, (next) => {
      if (active) {
        setSnapshot(next);
      }
    });

    return () => {
      active = false;
    };
  }, [enabled, nonce]);

  const reload = useCallback(() => {
    setNonce((value) => {
      return value + 1;
    });
  }, []);

  return {
    ...snapshot,
    reload,
  };
};
