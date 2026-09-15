import type { ProjectSummary } from '../types';

/*
 * Profile is part of the identity: the same directory opened under .claude and
 * .claude-personal is two projects with one id, and a session knows which of
 * the two it came from.
 */
export const findAgentProject = (
  projects: readonly ProjectSummary[] | undefined,
  projectId: string,
  agent: ProjectSummary['agent'],
  profile?: string,
): ProjectSummary | null => {
  return projects?.find((project) => {
    return project.agent === agent && project.id === projectId && project.profile === profile;
  }) ?? null;
};
