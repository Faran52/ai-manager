import { expect, test } from 'vitest';

import { isGlobalStatsResponse } from './globalStatsUtils';

test('accepts only an object whose stats carry an agents list', () => {
  expect(isGlobalStatsResponse({ stats: { agents: [] } })).toBe(true);
  expect(isGlobalStatsResponse({ stats: { agents: 'no' } })).toBe(false);
  expect(isGlobalStatsResponse({ stats: null })).toBe(false);
  expect(isGlobalStatsResponse({})).toBe(false);
  expect(isGlobalStatsResponse(null)).toBe(false);
});
