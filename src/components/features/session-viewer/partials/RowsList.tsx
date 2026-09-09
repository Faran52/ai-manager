import type { ToolInputRow } from '@services/history/historyService';
import type { FC } from 'react';

export interface RowsListProps {
  readonly rows: readonly ToolInputRow[];
}

export const RowsList: FC<RowsListProps> = ({ rows }) => {
  return (
    <dl className="space-y-1 text-body" data-rows-list>
      {rows.map((row, index) => {
        return (
          <div key={`${row.label}-${String(index)}`} className="flex gap-2">
            <dt className="shrink-0 text-dim">{row.label}</dt>
            <dd className="min-w-0 font-mono break-all text-foreground-2">
              {row.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
};
