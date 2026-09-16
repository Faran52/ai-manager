import { sumBy } from 'es-toolkit';

import type { AgentId } from '@config/agents';
import type {
  AgentStorage,
  StorageEntry,
  StorageReport,
} from '@services/storage/storageService';

export interface Held {
  readonly shown: readonly AgentStorage[];
  readonly totalBytes: number;
  readonly reclaimableBytes: number;
  readonly disposable: readonly StorageEntry[];
}

// Two "cache" rows under one agent tell the reader nothing; the parent folder does.
export const entryLabel = (entry: StorageEntry, siblings: readonly StorageEntry[]): string => {
  const repeated = siblings.some((other) => {
    return other !== entry && other.name === entry.name;
  });

  return repeated ? entry.path.split('/').slice(-2).join('/') : entry.name;
};

// What the storage panel shows: every agent, or the one named, with its totals
// and the entries the agents can rebuild on their own.
export const heldBy = (report: StorageReport | undefined, agent: AgentId | undefined): Held => {
  const shown = (report?.agents ?? []).filter((held) => {
    return agent == null || held.agent === agent;
  });

  return {
    shown,
    totalBytes: sumBy(shown, (held) => {
      return held.bytes;
    }),
    reclaimableBytes: sumBy(shown, (held) => {
      return held.reclaimableBytes;
    }),
    disposable: shown.flatMap((held) => {
      return held.entries.filter((entry) => {
        return entry.reclaimable;
      });
    }),
  };
};
