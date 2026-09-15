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

// What the storage panel shows: every agent, or the one named, with its totals
// and the entries the agents can rebuild on their own.
export const heldBy = (report: StorageReport | undefined, agent: AgentId | undefined): Held => {
  const shown = (report?.agents ?? []).filter((held) => {
    return agent == null || held.agent === agent;
  });

  return {
    shown,
    totalBytes: shown.reduce((total, held) => {
      return total + held.bytes;
    }, 0),
    reclaimableBytes: shown.reduce((total, held) => {
      return total + held.reclaimableBytes;
    }, 0),
    disposable: shown.flatMap((held) => {
      return held.entries.filter((entry) => {
        return entry.reclaimable;
      });
    }),
  };
};
