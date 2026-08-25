import {
  describe,
  expect,
  test,
} from 'vitest';

import { groupBySession } from './hitGroups';

import type { SearchHit } from '@services/search/searchService';

const hit = (filePath: string, role: SearchHit['role'], match: string): SearchHit => {
  return {
    agent: 'claude',
    filePath,
    projectId: 'project',
    sessionId: 'session',
    role,
    timestampMs: 0,
    before: '',
    match,
    after: '',
  };
};

describe('groupBySession', () => {
  test('collects hits of one session into a single group', () => {
    const hits = [hit('a.jsonl', 'user', 'one'), hit('a.jsonl', 'assistant', 'two')];

    expect(groupBySession(hits)).toEqual([{
      filePath: 'a.jsonl',
      sessionId: 'session',
      first: hits[0],
      hits,
    }]);
  });

  test('keeps separate sessions apart and preserves first-seen order', () => {
    const groups = groupBySession([
      hit('a.jsonl', 'user', 'one'),
      hit('b.jsonl', 'system', 'two'),
      hit('a.jsonl', 'summary', 'three'),
    ]);

    expect(groups.map((group) => {
      return group.filePath;
    })).toEqual(['a.jsonl', 'b.jsonl']);
    expect(groups[0]?.hits).toHaveLength(2);
    expect(groups[1]?.hits).toHaveLength(1);
  });

  test('returns no groups without hits', () => {
    expect(groupBySession([])).toEqual([]);
  });
});
