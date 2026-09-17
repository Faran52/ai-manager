import { expect, test } from 'vitest';

import {
  ASSISTANT_BASE_PX,
  ASSISTANT_BLOCK_PX,
  DATE_ROW_PX,
  PROSE_CHARS_PER_LINE,
  PROSE_LINE_PX,
  SUMMARY_ROW_PX,
  SYSTEM_ROW_PX,
  TOOL_USE_BLOCK_PX,
  USER_ROW_PX,
} from '../constants';

import { estimateRow } from './rowEstimateUtils';

import type { HistoryEntry } from '@services/history/historyService';
import type { TimelineRow } from './timelineUtils';

const rowOf = (entry: HistoryEntry): TimelineRow => {
  return {
    kind: 'entry',
    entry,
    key: 'k',
    dimmed: false,
    continues: false,
  };
};

const userRow = (text: string): TimelineRow => {
  return rowOf({
    kind: 'user',
    uuid: 'u',
    timestamp: 't',
    sidechain: false,
    meta: false,
    text,
    outcomes: [],
  });
};

test('estimates each row kind by its own height', () => {
  expect(estimateRow({
    kind: 'date',
    key: 'd',
    timestampMs: 0,
  })).toBe(DATE_ROW_PX);
  expect(estimateRow(userRow('q'))).toBe(USER_ROW_PX + PROSE_LINE_PX);
  expect(estimateRow(rowOf({
    kind: 'system',
    uuid: 's',
    timestamp: 't',
    sidechain: false,
    text: 'hook',
  }))).toBe(SYSTEM_ROW_PX);
  expect(estimateRow(rowOf({
    kind: 'summary',
    text: 'recap',
  }))).toBe(SUMMARY_ROW_PX);
});

test('estimates prose by the lines it wraps to, not the block it sits in', () => {
  const oneLine = estimateRow(userRow('q'));
  const threeHardLines = estimateRow(userRow('a\nb\nc'));
  const oneLongLine = estimateRow(userRow('x'.repeat(PROSE_CHARS_PER_LINE * 3)));

  expect(threeHardLines).toBe(USER_ROW_PX + 3 * PROSE_LINE_PX);
  // A line too long for the width costs the same as the breaks it would need.
  expect(oneLongLine).toBe(threeHardLines);
  expect(oneLine).toBeLessThan(threeHardLines);
});

test('estimates an assistant turn by its blocks, text by length and the rest flat', () => {
  expect(estimateRow(rowOf({
    kind: 'assistant',
    uuid: 'a',
    timestamp: 't',
    sidechain: false,
    blocks: [{
      blockType: 'text',
      text: 'a\nb',
    }, { blockType: 'redacted' }, {
      blockType: 'tool-use',
      call: {
        id: 'c',
        name: 'Bash',
        input: {
          kind: 'bash',
          command: 'ls',
        },
      },
    }],
  }))).toBe(ASSISTANT_BASE_PX + 2 * PROSE_LINE_PX + ASSISTANT_BLOCK_PX + TOOL_USE_BLOCK_PX);
});
