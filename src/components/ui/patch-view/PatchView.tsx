import { rowsOf } from '../utils/patchUtils';

import type { PatchHunk } from '@services/history/historyService';
import type { FC } from 'react';

export interface PatchViewProps {
  readonly hunks: readonly PatchHunk[];
}

const ROW_STYLES: Record<'add' | 'remove' | 'context', string> = {
  add: 'bg-ok/10 text-ok',
  remove: 'bg-destructive/10 text-destructive',
  context: 'text-muted-foreground',
};

const MARKERS: Record<'add' | 'remove' | 'context', string> = {
  add: '+',
  remove: '-',
  context: ' ',
};

export const PatchView: FC<PatchViewProps> = ({ hunks }) => {
  return (
    <div
      className="
        overflow-x-auto rounded-lg border border-border font-mono text-xs
      "
      data-patch-view
    >
      {hunks.map((hunk, index) => {
        /*
         * Coordinates alone do not identify a hunk: a multi-edit call diffs each edit
         * against its own fragment, so every one starts at line 1 and two collided.
         * React drops or duplicates children when keys collide.
         */
        const hunkKey = [
          hunk.file ?? '',
          hunk.oldStart,
          hunk.oldLines,
          hunk.newStart,
          hunk.newLines,
          ...hunk.lines,
        ].join('-');
        // A multi-file patch tags each hunk with its file; show the name once
        // where it changes, so the reader is never guessing which file a hunk is in.
        const fileHeader = hunk.file != null && hunk.file !== hunks[index - 1]?.file
          ? hunk.file
          : undefined;

        return (
          <div key={hunkKey}>
            {fileHeader != null && (
              <div
                className="
                  border-b border-border bg-muted px-3 py-1 text-body
                  font-medium break-all text-foreground-2
                "
                data-patch-file
              >
                {fileHeader}
              </div>
            )}
            <div className="
              border-b border-border bg-muted px-3 py-1 text-body
              text-muted-foreground
            "
            >
              @@ -
              {String(hunk.oldStart)}
              ,
              {String(hunk.oldLines)}
              {' '}
              +
              {String(hunk.newStart)}
              ,
              {String(hunk.newLines)}
              {' '}
              @@
            </div>
            {rowsOf(hunk).map((row, rowIndex) => {
              return (
                <div
                  key={`${hunkKey}-${String(rowIndex)}`}
                  className={`
                    px-3 py-px whitespace-pre
                    ${ROW_STYLES[row.kind]}
                  `}
                  data-diff-kind={row.kind}
                >
                  {`${MARKERS[row.kind]}${row.text}`}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
