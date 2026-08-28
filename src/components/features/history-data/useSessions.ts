import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { fetchSessions } from '@lib/apis/apiClient';

import { runLoad } from './asyncResource';

import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { AsyncResource, AsyncSnapshot } from './asyncResource';

const EMPTY: readonly SessionSummary[] = [];
const LIVE_REFRESH_MS = 3_000;

export const useSessions = (
  project: ProjectSummary | null,
  live = false,
): AsyncResource<readonly SessionSummary[]> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<readonly SessionSummary[]>>({ status: 'loading' });
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
          ? EMPTY
          : (await fetchSessions({
              projectId: project.id,
              agent: project.agent,
            })).sessions;
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

  useEffect(() => {
    if (!live || project == null) {
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
  }, [live, project, reload]);

  return {
    ...snapshot,
    reload,
  };
};
