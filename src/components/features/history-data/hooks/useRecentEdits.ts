import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { fetchRecentEdits } from '@lib/apis/apiClient';

import { runLoad } from '../utils/asyncResourceUtils';

import type { EditedFile } from '@services/edits/editsService';
import type { ProjectSummary } from '@services/history/historyService';
import type { AsyncResource, AsyncSnapshot } from '../utils/asyncResourceUtils';

const EMPTY: readonly EditedFile[] = [];

export const useRecentEdits = (
  project: ProjectSummary | null,
): AsyncResource<readonly EditedFile[]> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<readonly EditedFile[]>>({ status: 'loading' });
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
          : (await fetchRecentEdits({
              agent: project.agent,
              projectId: project.id,
            })).files;
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
