import {
  describe,
  expect,
  test,
} from 'vitest';

import { buildProjectTree } from './projectTreeUtils';

import type { AgentId } from '@config/agents';
import type { ProjectSummary } from '@services/history/historyService';

const project = (
  agent: AgentId,
  id: string,
  name: string,
  path: string | undefined,
  lastActivityMs: number,
): ProjectSummary => {
  return {
    agent,
    id,
    name,
    actualPath: path,
    sessionCount: 2,
    messageCount: 5,
    lastActivityMs,
  };
};

describe('buildProjectTree', () => {
  test('groups the same folder across agents', () => {
    const tree = buildProjectTree(
      [
        project('claude', 'claude-app', 'app', '/repo/app', 3),
        project('codex', 'codex-app', 'app', '/repo/app', 2),
      ],
      {
        agentFilter: [],
        textFilter: '',
      },
    );

    expect(tree).toHaveLength(1);
    expect(tree[0]?.agentCount).toBe(2);
    expect(tree[0]?.sessionCount).toBe(4);
    expect(tree[0]?.agents.map((branch) => {
      return branch.agent;
    })).toEqual(['claude', 'codex']);
  });

  test('sorts folders and branches by activity and falls back to names', () => {
    const tree = buildProjectTree(
      [
        project('claude', 'old', 'shared', undefined, 1),
        project('codex', 'new', 'shared', undefined, 5),
        project('claude', 'latest', 'latest', '/repo/latest', 9),
      ],
      {
        agentFilter: [],
        textFilter: '',
      },
    );

    expect(tree.map((group) => {
      return group.name;
    })).toEqual(['latest', 'shared']);
    expect(tree[1]?.agents[0]?.agent).toBe('codex');
  });

  test('applies agent and project text filters together', () => {
    const tree = buildProjectTree(
      [
        project('claude', 'claude-app', 'app', '/repo/app', 3),
        project('codex', 'codex-app', 'app', '/repo/app', 2),
      ],
      {
        agentFilter: ['codex'],
        textFilter: 'repo/app',
      },
    );

    expect(tree).toHaveLength(1);
    expect(tree[0]?.matchesFilter).toBe(true);
    expect(tree[0]?.agents).toHaveLength(1);
  });

  test('marks a folder name match and rejects an absent match', () => {
    const projects = [project('claude', 'app', 'Workspace', '/repo/app', 1)];

    expect(buildProjectTree(projects, {
      agentFilter: [],
      textFilter: 'WORK',
    })[0]?.matchesFilter).toBe(true);
    expect(buildProjectTree(projects, {
      agentFilter: [],
      textFilter: 'absent',
    })[0]?.matchesFilter).toBe(false);
  });
});

describe('worktrees', () => {
  const worktree = (
    agent: AgentId,
    id: string,
    path: string,
    repoPath: string,
  ): ProjectSummary => {
    return {
      ...project(agent, id, path.split('/').at(-1) ?? id, path, 5),
      repoPath,
    };
  };

  test('gathers a worktree under the repository it belongs to', () => {
    const groups = buildProjectTree([
      project('claude', 'main', 'app', '/repo/app', 9),
      worktree('claude', 'wt', '/repo/app-feature-x', '/repo/app'),
    ], {
      agentFilter: [],
      textFilter: '',
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe('app');
    expect(groups[0]?.actualPath).toBe('/repo/app');
    expect(groups[0]?.sessionCount).toBe(4);
    // The main tree is unnamed; only the worktree says which branch it is.
    expect(groups[0]?.agents.map((branch) => {
      return branch.worktree;
    })).toEqual([undefined, 'app-feature-x']);
  });

  test('names the group after the repository even with no main tree present', () => {
    const groups = buildProjectTree([
      worktree('claude', 'wt', '/checkouts/app-feature-x', '/repo/app'),
    ], {
      agentFilter: [],
      textFilter: '',
    });

    expect(groups[0]?.name).toBe('app');
    expect(groups[0]?.actualPath).toBe('/repo/app');
  });

  test('finds a group by the branch folder as well as the repository', () => {
    const projects = [
      project('claude', 'main', 'app', '/repo/app', 9),
      worktree('claude', 'wt', '/repo/app-feature-x', '/repo/app'),
    ];

    expect(buildProjectTree(projects, {
      agentFilter: [],
      textFilter: 'feature-x',
    })[0]?.matchesFilter).toBe(true);
  });

  test('falls back to the whole path when it has no last segment', () => {
    const groups = buildProjectTree([
      worktree('claude', 'wt', '/checkouts/one', '/'),
    ], {
      agentFilter: [],
      textFilter: '',
    });

    expect(groups[0]?.name).toBe('/');
  });

  test('leaves two unrelated repositories apart', () => {
    expect(buildProjectTree([
      worktree('claude', 'a', '/checkouts/one', '/repo/alpha'),
      worktree('claude', 'b', '/checkouts/two', '/repo/beta'),
    ], {
      agentFilter: [],
      textFilter: '',
    })).toHaveLength(2);
  });
});
