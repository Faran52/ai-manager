import type { ProjectSummary } from '../../history/types';

/**
 * Orders projects newest first.
 *
 * Ties are ordinary here: one folder opened in two agents appears twice under
 * the same name. Without the tie-breaks that order falls to directory
 * enumeration, so the same rows swap places between refreshes and between
 * machines.
 */
export const compareProjects = (left: ProjectSummary, right: ProjectSummary): number => {
  return right.lastActivityMs - left.lastActivityMs
    || left.name.localeCompare(right.name)
    || left.agent.localeCompare(right.agent);
};
