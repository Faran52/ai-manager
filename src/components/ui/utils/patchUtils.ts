import type { PatchHunk } from '@services/history/historyService';

export interface DiffRow {
  readonly kind: 'add' | 'remove' | 'context';
  readonly text: string;
}

// Splits unified-diff lines into typed rows for rendering.
export const rowsOf = (hunk: PatchHunk): readonly DiffRow[] => {
  return hunk.lines.map((line) => {
    const marker = line.charAt(0);
    const text = line.slice(1);

    if (marker === '+') {
      return {
        kind: 'add',
        text,
      };
    }

    return marker === '-'
      ? {
          kind: 'remove',
          text,
        }
      : {
          kind: 'context',
          text,
        };
  });
};
