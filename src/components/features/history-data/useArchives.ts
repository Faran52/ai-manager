import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { fetchArchives } from '@lib/apis/apiClient';

import { runLoad } from './asyncResource';

import type { ArchiveSummary } from '@services/archive/archiveService';
import type { AsyncResource, AsyncSnapshot } from './asyncResource';

export const useArchives = (enabled: boolean): AsyncResource<readonly ArchiveSummary[]> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<readonly ArchiveSummary[]>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let active = true;

    void runLoad(
      async () => {
        return (await fetchArchives()).archives;
      },
      (next) => {
        if (active) {
          setSnapshot(next);
        }
      },
    );

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
