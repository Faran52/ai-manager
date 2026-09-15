import { expect, test } from 'vitest';

import {
  ASSISTANT_BASE_PX,
  ASSISTANT_BLOCK_PX,
  DATE_ROW_PX,
  SUMMARY_ROW_PX,
  SYSTEM_ROW_PX,
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

test('estimates each row kind by its own height, assistants by their block count', () => {
  expect(estimateRow({
    kind: 'date',
    key: 'd',
    timestampMs: 0,
  })).toBe(DATE_ROW_PX);
  expect(estimateRow(rowOf({
    kind: 'user',
    uuid: 'u',
    timestamp: 't',
    sidechain: false,
    meta: false,
    text: 'q',
    outcomes: [],
  }))).toBe(USER_ROW_PX);
  expect(estimateRow(rowOf({
    kind: 'assistant',
    uuid: 'a',
    timestamp: 't',
    sidechain: false,
    blocks: [{
      blockType: 'text',
      text: 'a',
    }, { blockType: 'redacted' }],
  }))).toBe(ASSISTANT_BASE_PX + 2 * ASSISTANT_BLOCK_PX);
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
