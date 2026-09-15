import type { ProjectSummary } from '../../history/types';

/*
 * Ties are ordinary: one folder opened in two agents appears twice under the
 * same name. Without the tie-breaks that order falls to directory enumeration,
 * so rows swap places between refreshes and between machines.
 */
export const compareProjects = (left: ProjectSummary, right: ProjectSummary): number => {
  return right.lastActivityMs - left.lastActivityMs
    || left.name.localeCompare(right.name)
    || left.agent.localeCompare(right.agent);
};
