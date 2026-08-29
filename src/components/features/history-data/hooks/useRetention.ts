import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { fetchRetentionStatus } from '@lib/apis/apiClient';

import { runLoad } from '../utils/asyncResourceUtils';

import type { RetentionStatusResponse } from '@lib/apis/contracts';
import type { AsyncResource, AsyncSnapshot } from '../utils/asyncResourceUtils';

export const useRetention = (enabled: boolean): AsyncResource<RetentionStatusResponse> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<RetentionStatusResponse>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let active = true;

    void runLoad(fetchRetentionStatus, (next) => {
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
