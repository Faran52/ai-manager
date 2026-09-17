import { withinDateFilter } from './dateFilterUtils';

import type { AgentId } from '@config/agents';
import type { ProjectSummary } from '@services/history/historyService';
import type { DateFilter } from './dateFilterUtils';

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
  // The funnel's date window and reading direction, both defaulted so callers
  // that do not offer them (and their tests) need no change.
  readonly dateFilter?: DateFilter | undefined;
  readonly order?: 'newest' | 'oldest' | undefined;
  readonly nowMs?: number | undefined;
}

/*
 * The on-disk path is what makes one folder in three agents one project: a name
 * alone merges unrelated ones. A worktree keys on its repo, so a branch joins.
 */
const groupKeyOf = (project: ProjectSummary): string => {
  return project.repoPath ?? project.actualPath ?? `name:${project.name}`;
};

const baseNameOf = (path: string): string => {
  const segments = path.split('/').filter((segment) => {
    return segment.length > 0;
  });

  return segments.at(-1) ?? path;
};

export const buildProjectTree = (
  projects: readonly ProjectSummary[],
  options: BuildProjectTreeOptions,
): readonly TreeProjectGroup[] => {
  const needle = options.textFilter.trim().toLowerCase();
  const dateFilter = options.dateFilter ?? 'all';
  const nowMs = options.nowMs ?? Date.now();

  const grouped = Map.groupBy(projects.filter((project) => {
    return (options.agentFilter.length === 0 || options.agentFilter.includes(project.agent))
      && withinDateFilter(project.lastActivityMs, dateFilter, nowMs);
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
    return options.order === 'oldest'
      ? left.lastActivityMs - right.lastActivityMs
      : right.lastActivityMs - left.lastActivityMs;
  });

  return groups;
};
