import type { GlobalStats } from '@services/stats/statsService';

export interface GlobalStatsResponse {
  readonly stats: GlobalStats;
}

export const isGlobalStatsResponse = (value: unknown): value is GlobalStatsResponse => {
  return typeof value === 'object'
    && value !== null
    && 'stats' in value
    && typeof value.stats === 'object'
    && value.stats !== null
    && 'agents' in value.stats
    && Array.isArray(value.stats.agents);
};
