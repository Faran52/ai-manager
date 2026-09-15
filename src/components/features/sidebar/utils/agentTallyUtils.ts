import type { AgentId } from '@config/agents';
import type { ProjectSummary } from '@services/history/historyService';

export interface AgentTally {
  readonly agent: AgentId;
  // Undefined for the plain default root, same as ProjectSummary.profile: a
  // project used under only one profile tallies as one chip, not two.
  readonly profile?: string | undefined;
  readonly sessions: number;
}

// Sessions per agent and profile across every project, heaviest first.
export const talliedBy = (projects: readonly ProjectSummary[]): readonly AgentTally[] => {
  const sessions = new Map<string, AgentTally>();

  for (const project of projects) {
    const key = `${project.agent}:${project.profile ?? ''}`;
    const tally = sessions.get(key) ?? {
      agent: project.agent,
      profile: project.profile,
      sessions: 0,
    };

    sessions.set(key, {
      ...tally,
      sessions: tally.sessions + project.sessionCount,
    });
  }

  return [...sessions.values()].sort((left, right) => {
    return right.sessions - left.sessions;
  });
};
