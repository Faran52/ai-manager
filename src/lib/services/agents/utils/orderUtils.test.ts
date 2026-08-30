import {
  describe,
  expect,
  test,
} from 'vitest';

import { compareProjects } from './orderUtils';

import type { AgentId } from '@config/agents';
import type { ProjectSummary } from '../../history/types';

const project = (
  agent: AgentId,
  name: string,
  lastActivityMs: number,
): ProjectSummary => {
  return {
    agent,
    id: `${agent}:${name}`,
    name,
    sessionCount: 1,
    messageCount: 1,
    lastActivityMs,
  };
};

describe('compareProjects', () => {
  test('puts the most recent project first', () => {
    const older = project('claude', 'alpha', 1_000);
    const newer = project('codex', 'beta', 2_000);

    expect([older, newer].sort(compareProjects)).toEqual([newer, older]);
  });

  test('falls back to name when activity ties', () => {
    const beta = project('claude', 'beta', 1_000);
    const alpha = project('claude', 'alpha', 1_000);

    expect([beta, alpha].sort(compareProjects)).toEqual([alpha, beta]);
  });

  test('falls back to agent for one folder opened in two agents', () => {
    const openCode = project('opencode', 'ai-manager', 1_000);
    const claude = project('claude', 'ai-manager', 1_000);

    expect([openCode, claude].sort(compareProjects)).toEqual([claude, openCode]);
  });

  test('is stable for a project compared with itself', () => {
    const only = project('claude', 'alpha', 1_000);

    expect(compareProjects(only, only)).toBe(0);
  });
});
