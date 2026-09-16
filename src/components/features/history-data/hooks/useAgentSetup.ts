import { useCallback } from 'react';

import { fetchAgentSetup } from '@lib/apis/apiClient';

import { useAsyncResource } from './useAsyncResource';

import type { AgentSetupResponse } from '@lib/apis/contracts';
import type { AsyncResource } from '../utils/asyncResourceUtils';

const NONE: AgentSetupResponse = {
  setups: [],
  findings: [],
  usage: null,
  plugins: [],
  trust: {
    known: false,
    trusted: false,
    onboarded: false,
  },
};

// An empty path is the idle signal: no project is open, so there is nothing to read.
export const useAgentSetup = (projectPath: string): AsyncResource<AgentSetupResponse> => {
  const load = useCallback(async () => {
    return projectPath.length === 0 ? NONE : await fetchAgentSetup({ projectPath });
  }, [projectPath]);

  return useAsyncResource(load, true);
};
