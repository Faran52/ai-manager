import { expect, test } from 'vitest';

import { totalsOf } from './archiveTotalsUtils';

import type { ArchiveSummary } from '@services/archive/archiveService';

const archive = (sessionCount: number, sizeBytes: number): ArchiveSummary => {
  return {
    id: String(sessionCount),
    createdMs: 0,
    note: '',
    sessionCount,
    sizeBytes,
    agents: ['claude'],
    projectKeys: [],
  };
};

test('adds up the sessions and bytes of every archive', () => {
  expect(totalsOf([archive(2, 100), archive(3, 50)])).toEqual({
    sessions: 5,
    bytes: 150,
  });
  expect(totalsOf([])).toEqual({
    sessions: 0,
    bytes: 0,
  });
});
