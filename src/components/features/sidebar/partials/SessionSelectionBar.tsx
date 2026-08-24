import { CheckCheck, Trash2 } from 'lucide-react';

import type { FC } from 'react';

export interface SessionSelectionBarProps {
  readonly selectedCount: number;
  readonly allSelected: boolean;
  readonly onToggleAll: () => void;
  readonly onDelete: () => void;
}

export const SessionSelectionBar: FC<SessionSelectionBarProps> = ({
  selectedCount,
  allSelected,
  onToggleAll,
  onDelete,
}) => {
  return (
    <div className="session-selection-bar">
      <span className="session-selection-count">{`${String(selectedCount)} selected`}</span>
      <button
        type="button"
        aria-label={allSelected ? 'Clear selected sessions' : 'Select all sessions'}
        onClick={onToggleAll}
        className="session-selection-action"
      >
        <CheckCheck className="size-3" />
        {allSelected ? 'Clear' : 'All'}
      </button>
      <button
        type="button"
        aria-label="Delete selected"
        disabled={selectedCount === 0}
        onClick={onDelete}
        className="session-selection-delete"
      >
        <Trash2 className="size-3" />
        Delete
      </button>
    </div>
  );
};
