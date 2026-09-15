import { fetchStorage } from '@lib/apis/apiClient';

import { useAsyncResource } from './useAsyncResource';

import type { StorageReport } from '@services/storage/storageService';
import type { AsyncResource } from '../utils/asyncResourceUtils';

export const useStorage = (enabled: boolean): AsyncResource<StorageReport> => {
  return useAsyncResource(fetchStorage, enabled);
};
