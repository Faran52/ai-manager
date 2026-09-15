import { expect, test } from 'vitest';

import { heldBy } from './storageHeldUtils';

import type { StorageReport } from '@services/storage/storageService';

const report: StorageReport = {
  agents: [
    {
      agent: 'claude',
      label: 'Claude Code',
      bytes: 100,
      reclaimableBytes: 40,
      entries: [{
        name: 'cache',
        path: '/c',
        bytes: 40,
        reclaimable: true,
      }, {
        name: 'history',
        path: '/h',
        bytes: 60,
        reclaimable: false,
      }],
    },
    {
      agent: 'codex',
      label: 'Codex CLI',
      bytes: 10,
      reclaimableBytes: 0,
      entries: [],
    },
  ],
  totalBytes: 110,
  reclaimableBytes: 40,
  partial: false,
};

test('totals every agent, or only the one named, and lists what can be rebuilt', () => {
  const all = heldBy(report, undefined);

  expect(all.shown).toHaveLength(2);
  expect(all.totalBytes).toBe(110);
  expect(all.reclaimableBytes).toBe(40);
  expect(all.disposable.map((entry) => {
    return entry.name;
  })).toEqual(['cache']);

  const one = heldBy(report, 'codex');

  expect(one.shown).toHaveLength(1);
  expect(one.totalBytes).toBe(10);
  expect(heldBy(undefined, undefined).shown).toEqual([]);
});
