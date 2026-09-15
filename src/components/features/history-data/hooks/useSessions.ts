import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { fetchSessions } from '@lib/apis/apiClient';

import { runLoad } from '../utils/asyncResourceUtils';

import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { AsyncResource, AsyncSnapshot } from '../utils/asyncResourceUtils';

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
        if (project == null) {
          return EMPTY;
        }

        /**
         * The route answers for every sibling root sharing this project id
         * (the same directory opened under .claude and .claude-personal),
         * each session tagged with its own profile; keep only this branch's.
         */
        const { sessions } = await fetchSessions({
          projectId: project.id,
          agent: project.agent,
        });

        return sessions.filter((session) => {
          return session.profile === project.profile;
        });
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
