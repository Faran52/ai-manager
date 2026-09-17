import { useCallback } from 'react';

import { fetchSessions } from '@lib/apis/apiClient';

import { useLiveList } from './useLiveList';

import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { AsyncResource } from '../utils/asyncResourceUtils';

const EMPTY: readonly SessionSummary[] = [];

export const useSessions = (
  project: ProjectSummary | null,
): AsyncResource<readonly SessionSummary[]> => {
  const key = project == null ? '' : `${project.agent}:${project.id}:${project.profile ?? ''}`;
  const load = useCallback(async () => {
    if (project == null) {
      return EMPTY;
    }

    // The route answers for every sibling root sharing this project id, each
    // session tagged with its own profile; keep only this branch's.
    const { sessions } = await fetchSessions({
      projectId: project.id,
      agent: project.agent,
    });

    return sessions.filter((session) => {
      return session.profile === project.profile;
    });
  }, [project]);

  return useLiveList(key, load);
};
