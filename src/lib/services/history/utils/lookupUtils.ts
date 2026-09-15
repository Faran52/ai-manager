import type { ProjectSummary } from '../types';

// One string for "this agent's project": the shape archive summaries and the
// sidebar's name map both key on. Client-safe, unlike the archive service.
export const projectKeyOf = (agent: ProjectSummary['agent'], projectId: string): string => {
  return `${agent}:${projectId}`;
};

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
