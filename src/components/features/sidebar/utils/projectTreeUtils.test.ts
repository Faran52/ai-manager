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
