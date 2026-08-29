import {
  describe,
  expect,
  test,
} from 'vitest';

import { diffLines } from './diffUtils';

const linesOf = (before: string, after: string): readonly string[] => {
  return diffLines(before, after)[0]?.lines ?? [];
};

describe('diffLines', () => {
  test('reports nothing when the two versions are the same', () => {
    expect(diffLines('one\ntwo', 'one\ntwo')).toEqual([]);
  });

  test('shows a replaced line with the lines around it', () => {
    expect(linesOf('a\nb\nc\nd\ne', 'a\nb\nC\nd\ne')).toEqual([
      ' a',
      ' b',
      '-c',
      '+C',
      ' d',
      ' e',
    ]);
  });

  test('places the hunk where the change happened', () => {
    const [hunk] = diffLines('1\n2\n3\n4\n5\n6\n7\n8', '1\n2\n3\n4\nfive\n6\n7\n8');

    expect(hunk?.oldStart).toBe(2);
    expect(hunk?.newStart).toBe(2);
    expect(hunk?.oldLines).toBe(7);
    expect(hunk?.newLines).toBe(7);
  });

  test('reads an addition as an addition rather than a rewrite', () => {
    expect(linesOf('a\nb\nc', 'a\nb\nnew\nc')).toEqual([
      ' a',
      ' b',
      '+new',
      ' c',
    ]);
  });

  test('reads a deletion as a deletion', () => {
    expect(linesOf('a\ngone\nb', 'a\nb')).toEqual([
      ' a',
      '-gone',
      ' b',
    ]);
  });

  test('handles a file that had nothing in it before', () => {
    expect(linesOf('', 'first\nsecond')).toEqual([
      '-',
      '+first',
      '+second',
    ]);
  });

  test('reads an insertion before a matching line as an insertion', () => {
    expect(linesOf('x\ny', 'a\nx\nb\ny')).toEqual([
      '+a',
      ' x',
      '+b',
      ' y',
    ]);
  });

  test('keeps both sides in order when neither is a subsequence of the other', () => {
    expect(linesOf('a\nb\nc', 'c\nb\na')).toEqual([
      '-a',
      '-b',
      ' c',
      '+b',
      '+a',
    ]);
  });

  test('reports the whole region as replaced once comparing it line by line would be too slow', () => {
    const before = Array.from({ length: 1_100 }, (_unused, index) => {
      return `old-${String(index)}`;
    }).join('\n');
    const after = Array.from({ length: 1_100 }, (_unused, index) => {
      return `new-${String(index)}`;
    }).join('\n');
    const lines = linesOf(before, after);

    expect(lines).toHaveLength(2_200);
    expect(lines[0]).toBe('-old-0');
    expect(lines[1_100]).toBe('+new-0');
  });
});
