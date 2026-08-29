import { useEffect, useState } from 'react';

import { fetchFileHistory } from '@lib/apis/apiClient';

import { runLoad } from '../utils/asyncResourceUtils';

import type { FileHistoryResponse } from '@lib/apis/contracts';
import type { AsyncSnapshot } from '../utils/asyncResourceUtils';

export interface FileHistoryRequest {
  readonly sessionId: string;
  readonly path: string;
  readonly version?: number | undefined;
}

export const useFileHistory = ({
  sessionId,
  path,
  version,
}: FileHistoryRequest): AsyncSnapshot<FileHistoryResponse> => {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<FileHistoryResponse>>({ status: 'loading' });

  useEffect(() => {
    const live = { current: true };

    void runLoad(async () => {
      return fetchFileHistory({
        sessionId,
        path,
        version,
      });
    }, (next) => {
      if (live.current) {
        setSnapshot(next);
      }
    });

    return () => {
      live.current = false;
    };
  }, [path, sessionId, version]);

  return snapshot;
};
