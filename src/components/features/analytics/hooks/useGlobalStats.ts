import { useEffect, useState } from 'react';

import { isGlobalStatsResponse } from '../utils/globalStatsUtils';

import type { GlobalStats } from '@services/stats/statsService';

export interface GlobalSnapshot {
  readonly data?: GlobalStats | undefined;
  readonly status: 'loading' | 'ready' | 'error';
}

// The whole-machine report, read once on mount and dropped if the view leaves first.
export const useGlobalStats = (): GlobalSnapshot => {
  const [global, setGlobal] = useState<GlobalSnapshot>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch('/api/global-stats', { signal: controller.signal });
        const parsed: unknown = JSON.parse(await response.text());

        if (!response.ok || !isGlobalStatsResponse(parsed)) {
          throw new Error('Invalid global stats response');
        }

        if (!controller.signal.aborted) {
          setGlobal({
            data: parsed.stats,
            status: 'ready',
          });
        }
      }
      catch {
        if (!controller.signal.aborted) {
          setGlobal({ status: 'error' });
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  return global;
};
