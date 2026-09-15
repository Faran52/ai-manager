import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { runLoad } from '../utils/asyncResourceUtils';

import type { AsyncResource, AsyncSnapshot } from '../utils/asyncResourceUtils';

const LIVE_REFRESH_MS = 3_000;

/**
 * The shape every sessions list shares: load for one key, reset to loading
 * when the key changes, reload on demand, and while `live`, refetch every few
 * seconds and on the tab becoming visible again, but only while it is visible.
 *
 * `key` names what is loaded ('' for nothing, which never polls); `load` must
 * be stable per key, so callers wrap it in useCallback, and a new `load` for
 * the same key (a project list refreshed underneath) refetches without the
 * loading flash a key change brings.
 */
export const useLiveList = <T>(
  key: string,
  load: () => Promise<T>,
  live: boolean,
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

  useEffect(() => {
    if (!live || key === '') {
      return undefined;
    }

    const refresh = (): void => {
      if (document.visibilityState === 'visible') {
        reload();
      }
    };
    const interval = window.setInterval(refresh, LIVE_REFRESH_MS);

    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [key, live, reload]);

  return {
    ...snapshot,
    reload,
  };
};
