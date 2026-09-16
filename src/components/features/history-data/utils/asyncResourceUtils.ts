import { toErrorMessage } from '@utils/errorUtils';

import type { Dispatch, SetStateAction } from 'react';

export type AsyncStatus = 'loading' | 'ready' | 'error';

export interface AsyncResource<T> {
  readonly status: AsyncStatus;
  readonly data?: T | undefined;
  readonly error?: string | undefined;
  readonly reload: () => void;
}

export interface AsyncSnapshot<T> {
  status: AsyncStatus;
  data?: T | undefined;
  error?: string | undefined;
}

export const runLoad = async <T>(
  load: () => Promise<T>,
  setState: Dispatch<SetStateAction<AsyncSnapshot<T>>>,
): Promise<void> => {
  try {
    const data = await load();

    setState({
      status: 'ready',
      data,
    });
  }
  catch (cause) {
    setState({
      status: 'error',
      error: toErrorMessage(cause),
    });
  }
};
