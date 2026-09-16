import {
  describe,
  expect,
  test,
} from 'vitest';

import { findAgentProject, sessionLabel } from './lookupUtils';

import type { ProjectSummary } from '../types';

const project = (id: string, agent: ProjectSummary['agent']): ProjectSummary => {
  return {
    agent,
    id,
    name: id,
    sessionCount: 1,
    messageCount: 1,
    lastActivityMs: 0,
  };
};

describe('findAgentProject', () => {
  const projects = [project('alpha', 'claude'), project('beta', 'codex')];

  test('returns the project matching both agent and id', () => {
    expect(findAgentProject(projects, 'alpha', 'claude')).toBe(projects[0]);
    expect(findAgentProject(projects, 'beta', 'codex')).toBe(projects[1]);
  });

  test('returns null when the agent differs for the same id', () => {
    expect(findAgentProject(projects, 'alpha', 'copilot')).toBeNull();
  });

  test('returns null when no project carries the id', () => {
    expect(findAgentProject(projects, 'missing', 'claude')).toBeNull();
  });

  test('tells two profiles of the same project id apart', () => {
    const personal = {
      ...project('alpha', 'claude'),
      profile: 'Personal',
    };
    const both = [...projects, personal];

    expect(findAgentProject(both, 'alpha', 'claude', 'Personal')).toBe(personal);
    expect(findAgentProject(both, 'alpha', 'claude')).toBe(projects[0]);
  });

  test('returns null for an absent project list', () => {
    expect(findAgentProject(undefined, 'alpha', 'claude')).toBeNull();
  });
});

test('sessionLabel names a session by title, then summary, then preview, then id', () => {
  const base = {
    id: 'id',
    title: undefined,
    summary: undefined,
    preview: undefined,
  };

  expect(sessionLabel({
    ...base,
    title: 'Fix login',
  })).toBe('Fix login');
  expect(sessionLabel({
    ...base,
    summary: 'summarised',
  })).toBe('summarised');
  expect(sessionLabel({
    ...base,
    preview: 'first words',
  })).toBe('first words');
  expect(sessionLabel(base)).toBe('id');
});
