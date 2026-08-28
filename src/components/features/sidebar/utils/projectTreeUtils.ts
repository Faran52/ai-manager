import type { AgentId } from '@config/agents';
import type { ProjectSummary } from '@services/history/historyService';

export interface TreeAgentBranch {
  readonly agent: AgentId;
  readonly projectId: string;
  readonly sessionCount: number;
  readonly lastActivityMs: number;
  readonly source: ProjectSummary;
}

export interface TreeProjectGroup {
  readonly key: string;
  readonly name: string;
  readonly actualPath: string | undefined;
  readonly agentCount: number;
  readonly sessionCount: number;
  readonly lastActivityMs: number;
  readonly agents: readonly TreeAgentBranch[];
  readonly matchesFilter: boolean;
}

export interface BuildProjectTreeOptions {
  readonly agentFilter: readonly AgentId[];
  readonly textFilter: string;
}

/**
 * One folder opened in three agents is one project, not three. The on-disk path
 * is what makes them the same thing; the name alone would merge two unrelated
 * folders that happen to share a basename.
 */
const groupKeyOf = (project: ProjectSummary): string => {
  return project.actualPath ?? `name:${project.name}`;
};

export const buildProjectTree = (
  projects: readonly ProjectSummary[],
  options: BuildProjectTreeOptions,
): readonly TreeProjectGroup[] => {
  const needle = options.textFilter.trim().toLowerCase();

  const grouped = Map.groupBy(projects.filter((project) => {
    return options.agentFilter.length === 0 || options.agentFilter.includes(project.agent);
  }), groupKeyOf);

  const groups: TreeProjectGroup[] = [];

  for (const [key, members] of grouped) {
    const branches: TreeAgentBranch[] = [];
    let groupSessions = 0;
    let groupLastActivityMs = 0;

    for (const project of members) {
      groupSessions += project.sessionCount;
      groupLastActivityMs = Math.max(groupLastActivityMs, project.lastActivityMs);

      branches.push({
        agent: project.agent,
        projectId: project.id,
        sessionCount: project.sessionCount,
        lastActivityMs: project.lastActivityMs,
        source: project,
      });
    }

    branches.sort((left, right) => {
      return right.lastActivityMs - left.lastActivityMs;
    });

    const first = members[0];

    // v8 ignore next -- Map.groupBy never produces an empty member array.
    if (first == null) {
      continue;
    }

    const haystack = `${first.name} ${first.actualPath ?? ''} ${branches.map((branch) => {
      return branch.agent;
    }).join(' ')}`.toLowerCase();

    groups.push({
      key,
      name: first.name,
      actualPath: first.actualPath,
      agentCount: branches.length,
      sessionCount: groupSessions,
      lastActivityMs: groupLastActivityMs,
      agents: branches,
      matchesFilter: needle.length === 0 || haystack.includes(needle),
    });
  }

  groups.sort((left, right) => {
    return right.lastActivityMs - left.lastActivityMs;
  });

  return groups;
};
