import type { ArchiveSummary } from '@services/archive/archiveService';

export interface ArchiveTotals {
  readonly sessions: number;
  readonly bytes: number;
}

// What every listed archive adds up to.
export const totalsOf = (archives: readonly ArchiveSummary[]): ArchiveTotals => {
  return archives.reduce<ArchiveTotals>((totals, archive) => {
    return {
      sessions: totals.sessions + archive.sessionCount,
      bytes: totals.bytes + archive.sizeBytes,
    };
  }, {
    sessions: 0,
    bytes: 0,
  });
};
