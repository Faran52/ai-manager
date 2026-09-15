import { useCallback, useMemo } from 'react';

import { fetchSessions } from '@lib/apis/apiClient';

import { useLiveList } from './useLiveList';

import type { AgentId } from '@config/agents';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { AsyncResource } from '../utils/asyncResourceUtils';

// The one agent a global report is scoped to, distinct from the Funnel multi-
// select. profile narrows to one sibling root, matching ProjectSummary.profile.
export interface ReportScope {
  readonly agent: AgentId;
  readonly profile?: string | undefined;
}

const EMPTY: readonly SessionSummary[] = [];

/*
 * No server route exists for one agent across every project, so this fans out
 * the per-project fetch useSessions already makes. The per-project fetch takes
 * no profile, so the merged result is filtered afterward rather than trusted.
 */
export const useAgentSessions = (
  scope: ReportScope | null,
  projects: readonly ProjectSummary[],
  live = false,
): AsyncResource<readonly SessionSummary[]> => {
  // Split out so a caller passing a fresh scope object each render (an inline
  // literal) does not retrigger the load; only the values matter.
  const agent = scope?.agent ?? null;
  const profile = scope?.profile;
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
