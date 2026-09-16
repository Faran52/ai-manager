import { fetchProjects } from '@lib/apis/apiClient';

import { useAsyncResource } from './useAsyncResource';

import type { ProjectSummary } from '@services/history/historyService';
import type { AsyncResource } from '../utils/asyncResourceUtils';

const loadProjects = async (): Promise<readonly ProjectSummary[]> => {
  return (await fetchProjects()).projects;
};

export const useProjects = (): AsyncResource<readonly ProjectSummary[]> => {
  return useAsyncResource(loadProjects, true);
};
