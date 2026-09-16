import { useCallback, useState } from 'react';

import { fetchUpdateCheck } from '@lib/apis/apiClient';

export type ProbeStage = 'idle' | 'checking' | 'upToDate' | 'available' | 'failed';

export interface UpdateProbe {
  readonly stage: ProbeStage;
  // The version waiting, once one has been found.
  readonly version: string | undefined;
  readonly check: () => void;
}

/*
 * Asks the feed whether a newer build is out. It lives above the dialog rather
 * than inside it so the menu item can start the check as it opens it: a reader
 * who chose Check for Updates has already said what they want, and should not
 * have to say it again to a button.
 */
export const useUpdateProbe = (): UpdateProbe => {
  const [stage, setStage] = useState<ProbeStage>('idle');
  const [version, setVersion] = useState<string | undefined>(undefined);

  const check = useCallback((): void => {
    setStage('checking');

    void (async () => {
      try {
        const { update } = await fetchUpdateCheck();

        if (update.stage === 'available') {
          setVersion(update.version);
          setStage('available');

          return;
        }

        setStage('upToDate');
      }
      catch {
        setStage('failed');
      }
    })();
  }, []);

  return {
    stage,
    version,
    check,
  };
};
