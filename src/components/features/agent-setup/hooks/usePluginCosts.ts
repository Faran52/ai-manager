import { useEffect, useState } from 'react';

import { fetchPluginCosts } from '@lib/apis/apiClient';
import { toErrorMessage } from '@utils/errorUtils';

import type { PluginCostAttribution } from '@services/agents/agentsService';

export interface PluginCostsResource {
  readonly costs: readonly PluginCostAttribution[] | null;
  readonly error: string | null;
}

/*
 * The figures are why the table is worth opening, so they load with it. Every
 * write lands after the await, so the effect never sets state on its own render.
 */
export const usePluginCosts = (projectPath: string, profile?: string): PluginCostsResource => {
  const [costs, setCosts] = useState<readonly PluginCostAttribution[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    const read = async (): Promise<void> => {
      try {
        const response = await fetchPluginCosts({
          projectPath,
          profile,
        });

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
  }, [profile, projectPath]);

  return {
    costs,
    error,
  };
};
