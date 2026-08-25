import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { fetchStats } from '@lib/apis/apiClient';

import { runLoad } from './asyncResource';

import type { ProjectSummary } from '@services/history/historyService';
import type { ProjectStats } from '@services/stats/statsService';
import type { AsyncResource, AsyncSnapshot } from './asyncResource';

const NO_STATS = null;

export const useProjectStats = (project: ProjectSummary | null): AsyncResource<ProjectStats | null> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<ProjectStats | null>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  const projectKey = project == null ? '' : `${project.agent}:${project.id}`;
  const [prevProjectKey, setPrevProjectKey] = useState(projectKey);

  if (projectKey !== prevProjectKey) {
    setPrevProjectKey(projectKey);
    setSnapshot({ status: 'loading' });
  }

  useEffect(() => {
    let active = true;

    void runLoad(
      async () => {
        return project == null
          ? NO_STATS
          : (await fetchStats({
              projectId: project.id,
              agent: project.agent,
            })).stats;
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
  }, [nonce, project]);

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
