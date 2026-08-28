import {
  describe,
  expect,
  test,
} from 'vitest';

import { defaultMessageFilters } from './messageFilterUtils';
import {
  buildTimelineModel,
  dayAtRow,
  rowIndexForTimestamp,
} from './timelineUtils';

import type { HistoryEntry } from '@services/history/historyService';
import type { TimelineRow } from './timelineUtils';

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

const kindsOf = (rows: readonly TimelineRow[]): readonly string[] => {
  return rows.map((row) => {
    return row.kind === 'date' ? 'date' : row.entry.kind;
  });
};

describe('buildTimelineModel', () => {
  test('keeps one row per visible entry, in order', () => {
    const model = buildTimelineModel(entries, defaultMessageFilters());

    expect(kindsOf(model.rows)).toEqual(['user', 'assistant', 'summary']);
  });

  test('marks sidechain turns dimmed and leaves summaries undimmed', () => {
    const model = buildTimelineModel(entries, defaultMessageFilters());

    expect(model.rows.map((row) => {
      return row.kind === 'entry' && row.dimmed;
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

    expect(kindsOf(model.rows)).not.toContain('user');
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

describe('date separators', () => {
  test('opens each new day with one separator', () => {
    const model = buildTimelineModel(
      [
        userTurn('u1', '2026-06-01T10:00:00Z'),
        userTurn('u2', '2026-06-01T18:00:00Z'),
        userTurn('u3', '2026-06-02T09:00:00Z'),
      ],
      defaultMessageFilters(),
    );

    expect(kindsOf(model.rows)).toEqual(['date', 'user', 'user', 'date', 'user']);
    expect(model.rows[0]?.key).toBe('date-2026-06-01');
    expect(model.rows[3]?.key).toBe('date-2026-06-02');
  });

  test('lets a summary inherit the day already on screen', () => {
    const model = buildTimelineModel(
      [
        userTurn('u1', '2026-06-01T10:00:00Z'),
        {
          kind: 'summary',
          text: 'recap',
        },
        userTurn('u2', '2026-06-01T11:00:00Z'),
      ],
      defaultMessageFilters(),
    );

    expect(kindsOf(model.rows)).toEqual(['date', 'user', 'summary', 'user']);
  });

  test('opens no day for a timestamp it cannot read', () => {
    expect(kindsOf(buildTimelineModel([userTurn('u1', 'whenever')], defaultMessageFilters()).rows))
      .toEqual(['user']);
  });

  test('counts a day that a filter emptied out of the timeline', () => {
    const filters = defaultMessageFilters();
    const model = buildTimelineModel(
      [
        userTurn('u1', '2026-06-01T10:00:00Z'),
        userTurn('u2', '2026-06-02T10:00:00Z'),
      ],
      {
        ...filters,
        roles: {
          ...filters.roles,
          human: false,
        },
      },
    );

    expect(model.rows).toEqual([]);
  });
});

describe('dayAtRow', () => {
  test('reports the separator a row sits under', () => {
    const model = buildTimelineModel(
      [
        userTurn('u1', '2026-06-01T10:00:00Z'),
        userTurn('u2', '2026-06-02T09:00:00Z'),
      ],
      defaultMessageFilters(),
    );

    expect(dayAtRow(model.rows, 1)).toBe(Date.parse('2026-06-01T10:00:00Z'));
    expect(dayAtRow(model.rows, 3)).toBe(Date.parse('2026-06-02T09:00:00Z'));
  });

  test('clamps an index past the end and reports none above the first separator', () => {
    const model = buildTimelineModel([userTurn('u1', '2026-06-01T10:00:00Z')], defaultMessageFilters());

    expect(dayAtRow(model.rows, 99)).toBe(Date.parse('2026-06-01T10:00:00Z'));
    expect(dayAtRow(buildTimelineModel([userTurn('u1', 'whenever')], defaultMessageFilters()).rows, 0)).toBe(0);
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

  test('counts the separators when locating a row', () => {
    const model = buildTimelineModel(
      [userTurn('u1', '2026-06-01T10:00:00Z'), userTurn('u2', '2026-06-02T09:00:00Z')],
      defaultMessageFilters(),
    );

    expect(rowIndexForTimestamp(model.rows, '2026-06-02T09:00:00Z')).toBe(3);
  });
});

describe('speaker runs', () => {
  const assistantTurn = (uuid: string, timestamp: string, model = 'opus'): HistoryEntry => {
    return {
      kind: 'assistant',
      uuid,
      timestamp,
      sidechain: false,
      model,
      blocks: [{
        blockType: 'text',
        text: uuid,
      }],
    };
  };

  const continuations = (rows: readonly TimelineRow[]): readonly boolean[] => {
    return rows.flatMap((row) => {
      return row.kind === 'entry' ? [row.continues] : [];
    });
  };

  test('introduces only the first of a run of turns from one speaker', () => {
    const model = buildTimelineModel(
      [
        userTurn('u1', '2026-06-01T10:00:00Z'),
        assistantTurn('a1', '2026-06-01T10:00:10Z'),
        assistantTurn('a2', '2026-06-01T10:00:20Z'),
        assistantTurn('a3', '2026-06-01T10:00:30Z'),
        userTurn('u2', '2026-06-01T10:01:00Z'),
      ],
      defaultMessageFilters(),
    );

    expect(continuations(model.rows)).toEqual([false, false, true, true, false]);
  });

  test('reintroduces the speaker when the model changes', () => {
    const model = buildTimelineModel(
      [
        assistantTurn('a1', '2026-06-01T10:00:00Z', 'opus'),
        assistantTurn('a2', '2026-06-01T10:00:10Z', 'haiku'),
      ],
      defaultMessageFilters(),
    );

    expect(continuations(model.rows)).toEqual([false, false]);
  });

  test('reintroduces the speaker after a day separator', () => {
    const model = buildTimelineModel(
      [
        assistantTurn('a1', '2026-06-01T23:59:00Z'),
        assistantTurn('a2', '2026-06-02T00:01:00Z'),
      ],
      defaultMessageFilters(),
    );

    expect(continuations(model.rows)).toEqual([false, false]);
  });

  test('treats a summary between turns as a break in the run', () => {
    const model = buildTimelineModel(
      [
        assistantTurn('a1', '2026-06-01T10:00:00Z'),
        {
          kind: 'summary',
          text: 'recap',
        },
        assistantTurn('a2', '2026-06-01T10:00:10Z'),
      ],
      defaultMessageFilters(),
    );

    expect(continuations(model.rows)).toEqual([false, false, false]);
  });
});
