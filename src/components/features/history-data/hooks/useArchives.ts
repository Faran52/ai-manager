import { useCallback } from 'react';

import { fetchArchives } from '@lib/apis/apiClient';

import { useAsyncResource } from './useAsyncResource';

import type { ArchiveSummary } from '@services/archive/archiveService';
import type { AsyncResource } from '../utils/asyncResourceUtils';

export const useArchives = (enabled: boolean): AsyncResource<readonly ArchiveSummary[]> => {
  const load = useCallback(async () => {
    return (await fetchArchives()).archives;
  }, []);

  return useAsyncResource(load, enabled);
};
