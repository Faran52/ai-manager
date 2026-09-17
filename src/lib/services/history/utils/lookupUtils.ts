import type { ProjectSummary, SessionSummary } from '../types';

export type SessionLabelSource = Pick<SessionSummary, 'id'
  | 'preview'
  | 'summary'
  | 'title'>;

// One string for "this agent's project": the shape archive summaries and the
// sidebar's name map both key on. Client-safe, unlike the archive service.
export const projectKeyOf = (agent: ProjectSummary['agent'], projectId: string): string => {
  return `${agent}:${projectId}`;
};

/*
 * Profile is part of the identity: the same directory under .claude and
 * .claude-personal is two projects with one id.
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

// A session is named by whatever it carries, and every agent carries a different one of these.
export const sessionLabel = (session: SessionLabelSource): string => {
  return session.title ?? session.summary ?? session.preview ?? session.id;
};
