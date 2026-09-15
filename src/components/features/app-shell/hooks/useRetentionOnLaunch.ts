import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { runRetention } from '@lib/apis/apiClient';

import { useToast } from '@ui/index';

/**
 * The agents prune on their own schedule and this app is only running some of
 * the time, so the one moment it can get ahead of them is launch. Safe to do
 * unasked because retention copies and never deletes; a failure stays silent
 * rather than greeting someone with an error they did not ask for.
 */
export const useRetentionOnLaunch = (): void => {
  const { t } = useTranslation('archive');
  const { push: pushToast } = useToast();

  useEffect(() => {
    // A plain `let` reads as always-true to the compiler inside this closure, so
    // the flag lives on an object the cleanup can flip where it can be seen.
    const mounted = { current: true };

    void (async (): Promise<void> => {
      try {
        const { result } = await runRetention();

        if (mounted.current && result.archived > 0) {
          pushToast(t('retentionArchived', { count: result.archived }));
        }
      }
      catch {
        // Retention is a background courtesy; the Archive view reports failures properly.
      }
    })();

    return () => {
      mounted.current = false;
    };
  }, [pushToast, t]);
};
