import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { runLoad } from '../utils/asyncResourceUtils';

import type { AsyncResource, AsyncSnapshot } from '../utils/asyncResourceUtils';

/*
 * Read once per key, and again when reload is called. Only the open conversation
 * follows the disk; a list of them is refreshed by hand. load must be stable per
 * key: a new load for the same key refetches without the loading flash.
 */
export const useLiveList = <T>(
  key: string,
  load: () => Promise<T>,
): AsyncResource<T> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<T>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  const [prevKey, setPrevKey] = useState(key);

  if (key !== prevKey) {
    setPrevKey(key);
    setSnapshot({ status: 'loading' });
  }

  useEffect(() => {
    let active = true;

    void runLoad(load, (next) => {
      if (active) {
        setSnapshot(next);
      }
    });

    return () => {
      active = false;
    };
  }, [key, load, nonce]);

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
