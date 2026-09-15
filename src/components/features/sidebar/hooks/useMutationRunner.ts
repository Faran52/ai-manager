import { useState } from 'react';

import { toErrorMessage } from '@utils/errorUtils';

export interface MutationRunner {
  readonly busy: boolean;
  readonly error: string;
  // Resolves true when the action settled cleanly, so a dialog can close itself only then.
  readonly run: (action: () => Promise<void>) => Promise<boolean>;
}

// One busy flag and one error line shared by rename, delete and delete-project.
export const useMutationRunner = (): MutationRunner => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError('');

    try {
      await action();

      return true;
    }
    catch (cause: unknown) {
      setError(toErrorMessage(cause));

      return false;
    }
    finally {
      setBusy(false);
    }
  };

  return {
    busy,
    error,
    run,
  };
};
