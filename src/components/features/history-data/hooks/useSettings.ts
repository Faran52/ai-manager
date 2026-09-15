import { useCallback } from 'react';

import { fetchSettings } from '@lib/apis/apiClient';

import { useAsyncResource } from './useAsyncResource';

import type { AgentId } from '@config/agents';
import type { ScopeSettings } from '@services/settings/settingsService';
import type { AsyncResource } from '../utils/asyncResourceUtils';

export const useSettings = (
  projectPath: string | null,
  agent: AgentId = 'claude',
  profile?: string,
): AsyncResource<readonly ScopeSettings[]> => {
  // Resolved at render rather than inside the loader: the loader only ever runs
  // with a project chosen, so a fallback in there would be an unreachable branch.
  const path = projectPath ?? '';
  const load = useCallback(async () => {
    return (await fetchSettings({
      projectPath: path,
      agent,
      profile,
    })).scopes;
  }, [agent, path, profile]);

  return useAsyncResource(load, projectPath != null);
};
