import { useCallback } from 'react';

import { fetchAgentSetup } from '@lib/apis/apiClient';

import { useAsyncResource } from './useAsyncResource';

import type { AgentSetupResponse } from '@lib/apis/contracts';
import type { AsyncResource } from '../utils/asyncResourceUtils';

// An empty path is every project: the machine-level half of each agent's setup.
export const useAgentSetup = (projectPath: string): AsyncResource<AgentSetupResponse> => {
  const load = useCallback(async () => {
    return await fetchAgentSetup({ projectPath });
  }, [projectPath]);

  return useAsyncResource(load, true);
};
