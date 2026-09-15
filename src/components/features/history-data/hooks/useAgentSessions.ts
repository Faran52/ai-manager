import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { fetchSessions } from '@lib/apis/apiClient';

import { runLoad } from '../utils/asyncResourceUtils';

import type { AgentId } from '@config/agents';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { AsyncResource, AsyncSnapshot } from '../utils/asyncResourceUtils';

const EMPTY: readonly SessionSummary[] = [];
const LIVE_REFRESH_MS = 3_000;

/*
 * One agent, every project it has touched, rather than the one project
 * useSessions reads. There is no server route for this: it fans out the same
 * per-project fetch useSessions already makes and merges the answers, since
 * the agent's own project list is already on hand.
 *
 * `profile` narrows further to one same-agent sibling root ("Personal"),
 * mirroring what selecting one project branch already does. The per-project
 * fetch itself has no profile parameter (a project id can coincide across two
 * profiles' roots, and the route already answers with every root's matches
 * tagged), so the merged result is filtered by `session.profile` afterward
 * rather than trusted to come back pre-scoped.
 */
export const useAgentSessions = (
  agent: AgentId | null,
  profile: string | undefined,
  projects: readonly ProjectSummary[],
  live = false,
): AsyncResource<readonly SessionSummary[]> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<readonly SessionSummary[]>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  const scopeKey = agent == null ? '' : `${agent}:${profile ?? ''}`;
  const [prevScopeKey, setPrevScopeKey] = useState(scopeKey);

  if (scopeKey !== prevScopeKey) {
    setPrevScopeKey(scopeKey);
    setSnapshot({ status: 'loading' });
  }

  const agentProjects = useMemo(() => {
    return agent == null
      ? []
      : projects.filter((project) => {
          return project.agent === agent && project.profile === profile;
        });
  }, [agent, profile, projects]);

  useEffect(() => {
    let active = true;

    void runLoad(
      async () => {
        if (agent == null) {
          return EMPTY;
        }

        const results = await Promise.all(agentProjects.map((project) => {
          return fetchSessions({
            projectId: project.id,
            agent,
          });
        }));

        return results
          .flatMap((result) => {
            return result.sessions;
          })
          .filter((session) => {
            return session.profile === profile;
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
  }, [agent, agentProjects, nonce, profile]);

  const reload = useCallback(() => {
    setNonce((value) => {
      return value + 1;
    });
  }, []);

  useEffect(() => {
    if (!live || agent == null) {
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
  }, [agent, live, reload]);

  return {
    ...snapshot,
    reload,
  };
};
