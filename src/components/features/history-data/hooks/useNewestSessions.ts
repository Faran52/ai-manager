import { useEffect, useState } from 'react';

import { fetchNewestSessions } from '@lib/apis/apiClient';

import { runLoad } from '../utils/asyncResourceUtils';

import type { SessionSummary } from '@services/history/historyService';
import type { AsyncSnapshot } from '../utils/asyncResourceUtils';

export const useNewestSessions = (enabled: boolean): AsyncSnapshot<readonly SessionSummary[]> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<readonly SessionSummary[]>>({
    status: 'loading',
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const live = { current: true };

    void runLoad(async () => {
      return (await fetchNewestSessions()).sessions;
    }, (next) => {
      if (live.current) {
        setSnapshot(next);
      }
    });

    return () => {
      live.current = false;
    };
  }, [enabled]);

  return snapshot;
};
