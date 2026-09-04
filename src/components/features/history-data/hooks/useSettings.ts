import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { fetchSettings } from '@lib/apis/apiClient';

import { runLoad } from '../utils/asyncResourceUtils';

import type { AgentId } from '@config/agents';
import type { ScopeSettings } from '@services/settings/settingsService';
import type { AsyncResource, AsyncSnapshot } from '../utils/asyncResourceUtils';

export const useSettings = (
  projectPath: string | null,
  agent: AgentId = 'claude',
): AsyncResource<readonly ScopeSettings[]> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<readonly ScopeSettings[]>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (projectPath == null) {
      return undefined;
    }

    let active = true;

    void runLoad(
      async () => {
        return (await fetchSettings({
          projectPath,
          agent,
        })).scopes;
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
  }, [agent, nonce, projectPath]);

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
