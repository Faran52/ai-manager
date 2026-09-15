import { fetchRetentionStatus } from '@lib/apis/apiClient';

import { useAsyncResource } from './useAsyncResource';

import type { RetentionStatusResponse } from '@lib/apis/contracts';
import type { AsyncResource } from '../utils/asyncResourceUtils';

export const useRetention = (enabled: boolean): AsyncResource<RetentionStatusResponse> => {
  return useAsyncResource(fetchRetentionStatus, enabled);
};
