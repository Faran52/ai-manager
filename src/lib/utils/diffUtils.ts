import type { PatchHunk } from '@services/history/historyService';

const CONTEXT_LINES = 3;

/**
 * A line-by-line comparison costs one cell per pair of lines. Edits made by an
 * agent are almost always local, so trimming the matching head and tail leaves
 * a window small enough to compare exactly. When it does not, the window is
 * reported as one replacement rather than spending minutes finding a prettier
 * way to say the same thing.
 */
const MAX_CELLS = 1_000_000;

const commonPrefix = (before: readonly string[], after: readonly string[]): number => {
  let index = 0;

  while (index < before.length && index < after.length && before[index] === after[index]) {
    index += 1;
  }

  return index;
};

const commonSuffix = (
  before: readonly string[],
  after: readonly string[],
  prefix: number,
): number => {
  let index = 0;

  while (index < before.length - prefix
    && index < after.length - prefix
    && before[before.length - 1 - index] === after[after.length - 1 - index]) {
    index += 1;
  }

  return index;
};

// Indexes are derived from the loop bounds that sized the table, so a miss is
// impossible; the fallback exists only because the type cannot say so.
const cellAt = (table: Int32Array, index: number): number => {
  // v8 ignore next -- every index is inside the table by construction
  return table[index] ?? 0;
};

// Lengths of the longest common subsequence for every pair of suffixes, held
// flat so a row lookup cannot be missing and the whole table is one allocation.
const lcsLengths = (before: readonly string[], after: readonly string[]): Int32Array => {
  const width = after.length + 1;
  const table = new Int32Array((before.length + 1) * width);

  for (let row = before.length - 1; row >= 0; row -= 1) {
    for (let column = after.length - 1; column >= 0; column -= 1) {
      table[row * width + column] = before[row] === after[column]
        ? cellAt(table, (row + 1) * width + column + 1) + 1
        : Math.max(
            cellAt(table, (row + 1) * width + column),
            cellAt(table, row * width + column + 1),
          );
    }
  }

  return table;
};

const wholeReplacement = (before: readonly string[], after: readonly string[]): string[] => {
  return [
    ...before.map((line) => {
      return `-${line}`;
    }),
    ...after.map((line) => {
      return `+${line}`;
    }),
  ];
};

const walkTable = (before: readonly string[], after: readonly string[]): string[] => {
  const width = after.length + 1;
  const table = lcsLengths(before, after);
  const lines: string[] = [];
  let row = 0;
  let column = 0;

  while (row < before.length && column < after.length) {
    if (before[row] === after[column]) {
      lines.push(` ${String(before[row])}`);
      row += 1;
      column += 1;
      continue;
    }

    if (cellAt(table, (row + 1) * width + column) >= cellAt(table, row * width + column + 1)) {
      lines.push(`-${String(before[row])}`);
      row += 1;
      continue;
    }

    lines.push(`+${String(after[column])}`);
    column += 1;
  }

  return [
    ...lines,
    ...before.slice(row).map((line) => {
      return `-${line}`;
    }),
    ...after.slice(column).map((line) => {
      return `+${line}`;
    }),
  ];
};

const changedLines = (before: readonly string[], after: readonly string[]): string[] => {
  return before.length * after.length > MAX_CELLS
    ? wholeReplacement(before, after)
    : walkTable(before, after);
};

const splitLines = (text: string): readonly string[] => {
  return text.split('\n');
};

/**
 * Produces the single hunk that covers everything which changed, with a few
 * matching lines either side for orientation. One hunk rather than several
 * keeps this honest: the snapshots are whole files, so the reader is being
 * shown the entire difference, not a selection from it.
 */
export const diffLines = (beforeText: string, afterText: string): readonly PatchHunk[] => {
  const before = splitLines(beforeText);
  const after = splitLines(afterText);
  const prefix = commonPrefix(before, after);
  const suffix = commonSuffix(before, after, prefix);

  if (prefix === before.length && prefix === after.length) {
    return [];
  }

  const leading = Math.min(CONTEXT_LINES, prefix);
  const trailing = Math.min(CONTEXT_LINES, suffix);
  const oldMiddle = before.slice(prefix, before.length - suffix);
  const newMiddle = after.slice(prefix, after.length - suffix);

  return [{
    oldStart: prefix - leading + 1,
    oldLines: leading + oldMiddle.length + trailing,
    newStart: prefix - leading + 1,
    newLines: leading + newMiddle.length + trailing,
    lines: [
      ...before.slice(prefix - leading, prefix).map((line) => {
        return ` ${line}`;
      }),
      ...changedLines(oldMiddle, newMiddle),
      ...before.slice(before.length - suffix, before.length - suffix + trailing).map((line) => {
        return ` ${line}`;
      }),
    ],
  }];
};

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u;

const countOf = (value: string | undefined): number | undefined => {
  return value == null ? undefined : Number(value);
};

/**
 * Some agents record the difference they applied rather than the file it was
 * applied to, already written as a unified diff. Reading it back is cheaper and
 * more faithful than reconstructing one, so their own account is kept.
 *
 * Anything outside a hunk is ignored: the headers naming the file are already
 * known from the tool call that produced them.
 */
export const parseUnifiedDiff = (text: string): readonly PatchHunk[] => {
  const hunks: PatchHunk[] = [];
  let lines: string[] | undefined;

  for (const line of text.split('\n')) {
    const header = HUNK_HEADER.exec(line);

    if (header != null) {
      lines = [];
      hunks.push({
        oldStart: Number(header[1]),
        oldLines: countOf(header[2]) ?? 1,
        newStart: Number(header[3]),
        newLines: countOf(header[4]) ?? 1,
        lines,
      });
      continue;
    }

    if (lines != null && /^[ +-]/u.test(line)) {
      lines.push(line);
    }
  }

  return hunks.filter((hunk) => {
    return hunk.lines.length > 0;
  });
};
