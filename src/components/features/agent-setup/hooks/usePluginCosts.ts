import { useCallback, useState } from 'react';

import { fetchPluginCosts } from '@lib/apis/apiClient';
import { toErrorMessage } from '@utils/errorUtils';

import type { PluginCostAttribution } from '@services/agents/agentsService';

export interface PluginCostsResource {
  readonly costs: readonly PluginCostAttribution[] | null;
  readonly estimating: boolean;
  readonly error: string | null;
  readonly estimate: () => Promise<void>;
}

export const usePluginCosts = (projectPath: string): PluginCostsResource => {
  const [costs, setCosts] = useState<readonly PluginCostAttribution[] | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estimate = useCallback(async (): Promise<void> => {
    setEstimating(true);
    setError(null);

    try {
      const response = await fetchPluginCosts({ projectPath });

      setCosts(response.costs);
    }
    catch (cause) {
      setError(toErrorMessage(cause));
    }
    finally {
      setEstimating(false);
    }
  }, [projectPath]);

  return {
    costs,
    estimating,
    error,
    estimate,
  };
};
