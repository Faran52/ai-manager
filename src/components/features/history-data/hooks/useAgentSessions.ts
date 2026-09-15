import { useCallback, useMemo } from 'react';

import { fetchSessions } from '@lib/apis/apiClient';

import { useLiveList } from './useLiveList';

import type { AgentId } from '@config/agents';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { AsyncResource } from '../utils/asyncResourceUtils';

const EMPTY: readonly SessionSummary[] = [];

/*
 * One agent, every project it has touched, rather than the one project
 * useSessions reads. There is no server route for this: it fans out the same
 * per-project fetch useSessions already makes and merges the answers, since
 * the agent's own project list is already on hand.
 *
 * `profile` narrows further to one same-agent sibling root ("Personal"),
 * mirroring what selecting one project branch already does. The per-project
 * fetch itself has no profile parameter, so the merged result is filtered by
 * `session.profile` afterward rather than trusted to come back pre-scoped.
 */
export const useAgentSessions = (
  agent: AgentId | null,
  profile: string | undefined,
  projects: readonly ProjectSummary[],
  live = false,
): AsyncResource<readonly SessionSummary[]> => {
  const key = agent == null ? '' : `${agent}:${profile ?? ''}`;
  const agentProjects = useMemo(() => {
    return agent == null
      ? []
      : projects.filter((project) => {
          return project.agent === agent && project.profile === profile;
        });
  }, [agent, profile, projects]);
  const load = useCallback(async () => {
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
  }, [agent, agentProjects, profile]);

  return useLiveList(key, load, live);
};
