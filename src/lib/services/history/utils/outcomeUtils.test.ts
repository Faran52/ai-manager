import {
  describe,
  expect,
  test,
} from 'vitest';

import { pairToolOutcomes } from './outcomeUtils';

import type { HistoryEntry, ToolOutcome } from '@services/history/historyService';

const outcome = (toolUseId: string): ToolOutcome => {
  return {
    toolUseId,
    status: 'ok',
    images: [],
  };
};

const userWith = (...ids: readonly string[]): HistoryEntry => {
  return {
    kind: 'user',
    uuid: `u-${ids.join()}`,
    timestamp: 't',
    sidechain: false,
    meta: false,
    text: '',
    outcomes: ids.map(outcome),
  };
};

describe('pairToolOutcomes', () => {
  test('indexes outcomes by tool call id and skips anonymous ones', () => {
    const entries = [userWith('tu1', '')];
    const pairs = pairToolOutcomes(entries);

    expect(pairs.get('tu1')).toEqual({
      toolUseId: 'tu1',
      status: 'ok',
      images: [],
    });
    expect(pairs.has('')).toBe(false);
  });
});
