import type { GlobalStats } from '@services/stats/statsService';

export interface GlobalStatsResponse {
  readonly stats: GlobalStats;
}

// The shape the global stats endpoint answers with, checked before it is trusted.
export const isGlobalStatsResponse = (value: unknown): value is GlobalStatsResponse => {
  return typeof value === 'object'
    && value !== null
    && 'stats' in value
    && typeof value.stats === 'object'
    && value.stats !== null
    && 'agents' in value.stats
    && Array.isArray(value.stats.agents);
};
