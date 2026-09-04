import type { AgentId } from '@config/agents';
import type { ProjectSummary } from '@services/history/historyService';

export interface TreeAgentBranch {
  readonly agent: AgentId;
  readonly projectId: string;
  readonly sessionCount: number;
  readonly lastActivityMs: number;
  readonly source: ProjectSummary;
  // The folder name, when this branch is a worktree rather than the main tree.
  readonly worktree?: string | undefined;
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
 *
 * A linked worktree keys on the repository it belongs to, so a branch checked
 * out beside the main tree joins it instead of standing alone.
 */
const groupKeyOf = (project: ProjectSummary): string => {
  return project.repoPath ?? project.actualPath ?? `name:${project.name}`;
};

const baseNameOf = (path: string): string => {
  return path.split('/').filter((segment) => {
    return segment.length > 0;
  }).at(-1) ?? path;
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
        worktree: project.repoPath == null || project.actualPath == null
          ? undefined
          : baseNameOf(project.actualPath),
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

    const repoPath = members.find((project) => {
      return project.repoPath != null;
    })?.repoPath;
    const groupPath = repoPath ?? first.actualPath;
    const groupName = repoPath == null ? first.name : baseNameOf(repoPath);
    const haystack = `${groupName} ${groupPath ?? ''} ${branches.map((branch) => {
      return `${branch.agent} ${branch.worktree ?? ''}`;
    }).join(' ')}`.toLowerCase();

    groups.push({
      key,
      name: groupName,
      actualPath: groupPath,
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
