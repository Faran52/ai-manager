import {
  describe,
  expect,
  test,
} from 'vitest';

import { rowsOf } from './patchUtils';

import type { PatchHunk } from '@services/history/historyService';

const hunk = (lines: readonly string[]): PatchHunk => {
  return {
    oldStart: 1,
    oldLines: lines.length,
    newStart: 1,
    newLines: lines.length,
    lines,
  };
};

describe('rowsOf', () => {
  test('classifies added, removed, and context lines by their marker', () => {
    expect(rowsOf(hunk(['+added', '-removed', ' same']))).toEqual([
      {
        kind: 'add',
        text: 'added',
      },
      {
        kind: 'remove',
        text: 'removed',
      },
      {
        kind: 'context',
        text: 'same',
      },
    ]);
  });

  test('treats an empty line as context', () => {
    expect(rowsOf(hunk(['']))).toEqual([{
      kind: 'context',
      text: '',
    }]);
  });
});
