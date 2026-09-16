import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { runLoad } from '../utils/asyncResourceUtils';

import type { AsyncResource, AsyncSnapshot } from '../utils/asyncResourceUtils';

/*
 * `load` must be stable: a new identity refetches, which is how a changed
 * project reaches the server. `enabled` false never asks.
 */
export const useAsyncResource = <T>(
  load: () => Promise<T>,
  enabled: boolean,
): AsyncResource<T> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<T>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let active = true;

    void runLoad(load, (next) => {
      if (active) {
        setSnapshot(next);
      }
    });

    return () => {
      active = false;
    };
  }, [enabled, load, nonce]);

  const reload = useCallback(() => {
    setSnapshot((current) => {
      return {
        ...current,
        status: current.data === undefined ? 'loading' : current.status,
      };
    });
    setNonce((value) => {
      return value + 1;
    });
  }, []);

  return {
    ...snapshot,
    reload,
  };
};
