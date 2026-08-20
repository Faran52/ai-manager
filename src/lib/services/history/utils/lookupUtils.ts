import type { ProjectSummary } from '../types';

export const findAgentProject = (
  projects: readonly ProjectSummary[] | undefined,
  projectId: string,
  agent: ProjectSummary['agent'],
): ProjectSummary | null => {
  return projects?.find((project) => {
    return project.agent === agent && project.id === projectId;
  }) ?? null;
};
