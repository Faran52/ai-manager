import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { fetchProjects } from '@lib/apis/apiClient';

import { runLoad } from './asyncResource';

import type { ProjectSummary } from '@services/history/historyService';
import type { AsyncResource, AsyncSnapshot } from './asyncResource';

export const useProjects = (): AsyncResource<readonly ProjectSummary[]> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<readonly ProjectSummary[]>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;

    void runLoad(
      async () => {
        return (await fetchProjects()).projects;
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
  }, [nonce]);

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
