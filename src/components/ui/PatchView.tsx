import { rowsOf } from './utils/patchUtils';

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
      {hunks.map((hunk) => {
        const hunkKey = [hunk.oldStart, hunk.oldLines, hunk.newStart, hunk.newLines].join('-');

        return (
          <div key={hunkKey}>
            <div className="
              border-b border-border bg-muted px-3 py-1 text-[11px]
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
