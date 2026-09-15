import { expect, test } from 'vitest';

import { talliedBy } from './agentTallyUtils';

import type { AgentId } from '@config/agents';
import type { ProjectSummary } from '@services/history/historyService';

const project = (agent: AgentId, sessionCount: number, profile?: string): ProjectSummary => {
  return {
    agent,
    id: `${agent}-${profile ?? 'root'}`,
    name: 'app',
    sessionCount,
    messageCount: 0,
    lastActivityMs: 0,
    profile,
  };
};

test('tallies sessions per agent and profile, heaviest first', () => {
  const tallies = talliedBy([
    project('claude', 2),
    project('codex', 5),
    project('claude', 4),
    project('claude', 1, 'work'),
  ]);

  expect(tallies).toEqual([
    {
      agent: 'claude',
      profile: undefined,
      sessions: 6,
    },
    {
      agent: 'codex',
      profile: undefined,
      sessions: 5,
    },
    {
      agent: 'claude',
      profile: 'work',
      sessions: 1,
    },
  ]);
});
