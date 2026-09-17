import type { ProjectSummary } from '../../history/types';

/*
 * Ties are ordinary: one folder opened in two agents appears twice. Without the
 * tie-breaks the order falls to directory enumeration and rows swap on refresh.
 */
export const compareProjects = (left: ProjectSummary, right: ProjectSummary): number => {
  return right.lastActivityMs - left.lastActivityMs
    || left.name.localeCompare(right.name)
    || left.agent.localeCompare(right.agent);
};
