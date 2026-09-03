import { useEffect, useState } from 'react';

import { fetchPluginCosts } from '@lib/apis/apiClient';
import { toErrorMessage } from '@utils/errorUtils';

import type { PluginCostAttribution } from '@services/agents/agentsService';

export interface PluginCostsResource {
  readonly costs: readonly PluginCostAttribution[] | null;
  readonly error: string | null;
}

/*
 * The figures are the reason the table is worth opening, so they are read with
 * it rather than waiting behind a press. Every write lands after the await, so
 * the effect body never sets state on the render that scheduled it.
 */
export const usePluginCosts = (projectPath: string): PluginCostsResource => {
  const [costs, setCosts] = useState<readonly PluginCostAttribution[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    const read = async (): Promise<void> => {
      try {
        const response = await fetchPluginCosts({ projectPath });

        if (live) {
          setCosts(response.costs);
        }
      }
      catch (cause) {
        if (live) {
          setError(toErrorMessage(cause));
        }
      }
    };

    void read();

    return () => {
      live = false;
    };
  }, [projectPath]);

  return {
    costs,
    error,
  };
};
