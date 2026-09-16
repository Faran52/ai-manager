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
  const [prevLoad, setPrevLoad] = useState(() => {
    return load;
  });

  // A new `load` is a different resource, not a refresh: wait again rather than
  // show the last one's answer. `reload` keeps its data on purpose.
  if (load !== prevLoad) {
    setPrevLoad(() => {
      return load;
    });
    setSnapshot({ status: 'loading' });
  }

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
