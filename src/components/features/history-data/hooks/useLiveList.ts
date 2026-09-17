import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { runLoad } from '../utils/asyncResourceUtils';
import { subscribeToChanges } from '../utils/changeStreamUtils';

import type { AsyncResource, AsyncSnapshot } from '../utils/asyncResourceUtils';

/*
 * key names what is loaded, and the empty string never listens. load must be
 * stable per key: a new load for the same key refetches without the loading flash.
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

    /*
     * A hidden window reloads once it is looked at again rather than on every
     * event, so a background window costs nothing while the reader is elsewhere.
     */
    let missed = false;

    const refresh = (): void => {
      if (document.visibilityState === 'visible') {
        missed = false;
        reload();

        return;
      }

      missed = true;
    };

    const onVisible = (): void => {
      if (document.visibilityState === 'visible' && missed) {
        refresh();
      }
    };

    const unsubscribe = subscribeToChanges(refresh);

    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key, live, reload]);

  return {
    ...snapshot,
    reload,
  };
};
