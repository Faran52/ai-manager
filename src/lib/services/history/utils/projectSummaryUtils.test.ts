import { expect, test } from 'vitest';

import { namedByFolder, projectsFromSessions } from './projectSummaryUtils';

import type { SessionSummary } from '../types';

const session = (id: string, projectId: string, lastTimestampMs: number, cwd?: string): SessionSummary => {
  return {
    agent: 'gemini',
    actualSessionId: id,
    id,
    filePath: `/r/${id}`,
    projectId,
    messageCount: 2,
    firstTimestampMs: 0,
    lastTimestampMs,
    modifiedMs: 0,
    sizeBytes: 1,
    cwd,
  };
};

test('folds sessions into projects by id, newest project first, named by a recorded folder', () => {
  const projects = projectsFromSessions('gemini', [
    session('a', 'p1', 10),
    session('b', 'p2', 50, '/home/me/web'),
    session('c', 'p1', 30, '/home/me/api'),
  ], namedByFolder('Unknown project'));

  expect(projects).toEqual([
    {
      agent: 'gemini',
      id: 'p2',
      name: 'web',
      actualPath: '/home/me/web',
      sessionCount: 1,
      messageCount: 2,
      lastActivityMs: 50,
    },
    {
      agent: 'gemini',
      id: 'p1',
      name: 'api',
      actualPath: '/home/me/api',
      sessionCount: 2,
      messageCount: 4,
      lastActivityMs: 30,
    },
  ]);
});

test('falls back to the given name when no session recorded a folder', () => {
  const [project] = projectsFromSessions('gemini', [session('a', 'p1', 10)], namedByFolder('Unplaced'));

  expect(project?.name).toBe('Unplaced');
  expect(project?.actualPath).toBeUndefined();
});
