import type { ToolInputRow } from '@services/history/historyService';
import type { FC } from 'react';

export interface RowsListProps {
  readonly rows: readonly ToolInputRow[];
}

export const RowsList: FC<RowsListProps> = ({ rows }) => {
  return (
    <dl className="space-y-1 text-xs" data-rows-list>
      {rows.map((row, index) => {
        return (
          <div key={`${row.label}-${String(index)}`} className="flex gap-2">
            <dt className="w-20 shrink-0 text-end text-muted-foreground">
              {row.label}
            </dt>
            <dd className="font-mono break-all text-foreground">
              {row.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
};
