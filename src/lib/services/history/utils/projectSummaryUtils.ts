import { basename } from 'node:path';

import { sumBy } from 'es-toolkit';

import { maxOf } from '@utils/arrayUtils';

import type { AgentId } from '@config/agents';
import type { ProjectSummary, SessionSummary } from '../types';

export interface ProjectNaming {
  readonly name: string;
  readonly actualPath: string | undefined;
}

export type ProjectDescriber = (id: string, members: readonly SessionSummary[]) => ProjectNaming;

// The common case: a project is named for the first folder any of its sessions recorded.
export const namedByFolder = (fallback: string): ProjectDescriber => {
  return (_id, members) => {
    const folder = members.find((member) => {
      return member.cwd != null;
    })?.cwd;

    return {
      name: folder == null ? fallback : basename(folder),
      actualPath: folder,
    };
  };
};

/*
 * Every reader lists sessions and then folds them into projects by id the same
 * way; only how a project is named differs, and that is what the describer says.
 */
export const projectsFromSessions = (
  agent: AgentId,
  sessions: readonly SessionSummary[],
  describe: ProjectDescriber,
): readonly ProjectSummary[] => {
  const grouped = Map.groupBy(sessions, (session) => {
    return session.projectId;
  });
  const projects = [...grouped].map(([id, members]): ProjectSummary => {
    return {
      agent,
      id,
      ...describe(id, members),
      sessionCount: members.length,
      messageCount: sumBy(members, (member) => {
        return member.messageCount;
      }),
      lastActivityMs: maxOf(members, (member) => {
        return member.lastTimestampMs;
      }),
    };
  });

  return projects.sort((left, right) => {
    return right.lastActivityMs - left.lastActivityMs;
  });
};
