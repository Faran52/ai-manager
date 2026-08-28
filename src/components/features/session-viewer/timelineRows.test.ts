import {
  describe,
  expect,
  test,
} from 'vitest';

import { defaultMessageFilters } from './messageFilters';
import { buildTimelineModel, rowIndexForTimestamp } from './timelineRows';

import type { HistoryEntry } from '@services/history/historyService';

const userTurn = (uuid: string, timestamp: string, sidechain = false): HistoryEntry => {
  return {
    kind: 'user',
    uuid,
    timestamp,
    sidechain,
    meta: false,
    text: `text ${uuid}`,
    outcomes: [],
  };
};

const entries: HistoryEntry[] = [
  userTurn('u1', 't1'),
  {
    kind: 'assistant',
    uuid: 'a1',
    timestamp: 't2',
    sidechain: true,
    model: 'm',
    blocks: [{
      blockType: 'text',
      text: 'answer',
    }],
  },
  {
    kind: 'summary',
    text: 'recap',
  },
];

describe('buildTimelineModel', () => {
  test('keeps one row per visible entry, in order', () => {
    const model = buildTimelineModel(entries, defaultMessageFilters());

    expect(model.rows.map((row) => {
      return row.entry.kind;
    })).toEqual(['user', 'assistant', 'summary']);
  });

  test('marks sidechain turns dimmed and leaves summaries undimmed', () => {
    const model = buildTimelineModel(entries, defaultMessageFilters());

    expect(model.rows.map((row) => {
      return row.dimmed;
    })).toEqual([false, true, false]);
  });

  test('gives duplicate entries distinct keys', () => {
    const model = buildTimelineModel([userTurn('same', 't1'), userTurn('same', 't1')], defaultMessageFilters());
    const [first, second] = model.rows;

    expect(first?.key).not.toBe(second?.key);
  });

  test('drops filtered entries rather than leaving a gap', () => {
    const filters = defaultMessageFilters();
    const model = buildTimelineModel(entries, {
      ...filters,
      roles: {
        ...filters.roles,
        human: false,
      },
    });

    expect(model.rows.some((row) => {
      return row.entry.kind === 'user';
    })).toBe(false);
  });

  test('reports an outcome with no matching call as an orphan', () => {
    const withOrphan: HistoryEntry = {
      kind: 'user',
      uuid: 'u9',
      timestamp: 't9',
      sidechain: false,
      meta: false,
      text: 'q',
      outcomes: [{
        toolUseId: 'missing',
        status: 'ok',
        images: [],
        text: undefined,
      }],
    };
    const model = buildTimelineModel([withOrphan], defaultMessageFilters());

    expect(model.orphans.get('u9')).toHaveLength(1);
  });

  test('records no orphans for a turn that carries none', () => {
    const model = buildTimelineModel([userTurn('u1', 't1')], defaultMessageFilters());

    expect(model.orphans.has('u1')).toBe(false);
  });

  test('returns nothing for an empty feed', () => {
    const model = buildTimelineModel([], defaultMessageFilters());

    expect(model.rows).toEqual([]);
  });
});

describe('rowIndexForTimestamp', () => {
  test('finds the row carrying the timestamp', () => {
    const model = buildTimelineModel(entries, defaultMessageFilters());

    expect(rowIndexForTimestamp(model.rows, 't2')).toBe(1);
  });

  test('reports no row when the timestamp is absent', () => {
    const model = buildTimelineModel(entries, defaultMessageFilters());

    expect(rowIndexForTimestamp(model.rows, 'nope')).toBe(-1);
  });

  test('reports no row when no timestamp was asked for', () => {
    const model = buildTimelineModel(entries, defaultMessageFilters());

    expect(rowIndexForTimestamp(model.rows, undefined)).toBe(-1);
  });

  test('never matches a summary, which carries no timestamp', () => {
    const model = buildTimelineModel([{
      kind: 'summary',
      text: 'recap',
    }], defaultMessageFilters());

    expect(rowIndexForTimestamp(model.rows, 't1')).toBe(-1);
  });
});
