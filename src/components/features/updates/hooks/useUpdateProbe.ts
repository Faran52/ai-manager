import {
  useCallback,
  useEffect,
  useState,
} from 'react';

export type ProbeStage
  = | 'idle'
    | 'checking'
    | 'upToDate'
    | 'available'
    | 'unpublished'
    | 'downloading'
    | 'failed';

export interface UpdateProbe {
  readonly stage: ProbeStage;
  // The version waiting, once one has been found.
  readonly version: string | undefined;
  // Nought to one while downloading, absent where the release names no size.
  readonly progress: number | undefined;
  readonly check: () => void;
  // Absent where the shell cannot replace its own build, so no button is drawn.
  readonly install: (() => void)
    | undefined;
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
  const [progress, setProgress] = useState<number | undefined>(undefined);

  useEffect(() => {
    const onProgress = (event: WindowEventMap['app-update-progress']): void => {
      setProgress(event.detail);
      setStage('downloading');
    };

    window.addEventListener('app-update-progress', onProgress);

    return () => {
      window.removeEventListener('app-update-progress', onProgress);
    };
  }, []);

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

        if (update.unpublished === true) {
          setStage('unpublished');

          return;
        }

        setStage(update.available ? 'available' : 'upToDate');
      }
      catch {
        setStage('failed');
      }
    })();
  }, []);

  // The app quits into the swap, so only a failure ever comes back.
  const install = useCallback((): void => {
    const apply = window.bindings?.installUpdate;

    /* v8 ignore next 3 -- the caller offers no button where there is no binding */
    if (apply == null) {
      return;
    }

    setStage('downloading');

    void (async () => {
      try {
        await apply();
      }
      catch {
        setStage('failed');
      }
    })();
  }, []);

  return {
    stage,
    version,
    progress,
    check,
    install: window.bindings?.installUpdate == null ? undefined : install,
  };
};
