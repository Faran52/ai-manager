import { useCallback, useState } from 'react';

export type ProbeStage = 'idle' | 'checking' | 'upToDate' | 'available' | 'failed';

export interface UpdateProbe {
  readonly stage: ProbeStage;
  // The version waiting, once one has been found.
  readonly version: string | undefined;
  readonly check: () => void;
}

/*
 * Asks the installed build's own updater whether a newer one is out. It lives
 * above the dialog rather than inside it so the menu item can start the check
 * as it opens it: a reader who chose Check for Updates has already said what
 * they want, and should not have to say it again to a button.
 */
export const useUpdateProbe = (): UpdateProbe => {
  const [stage, setStage] = useState<ProbeStage>('idle');
  const [version, setVersion] = useState<string | undefined>(undefined);

  const check = useCallback((): void => {
    const ask = window.bindings?.checkForUpdate;

    // A browser has no installed build to replace, so nothing can answer.
    if (ask == null) {
      setStage('failed');

      return;
    }

    setStage('checking');

    void (async () => {
      try {
        const update = await ask();

        setVersion(update.version);
        setStage(update.available ? 'available' : 'upToDate');
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
