import { useTranslation } from 'react-i18next';

import {
  Archive,
  CheckCheck,
  Download,
  Trash2,
} from 'lucide-react';

import type { FC } from 'react';

export interface SessionSelectionBarProps {
  readonly selectedCount: number;
  readonly allSelected: boolean;
  readonly onToggleAll: () => void;
  readonly onDelete: () => void;
  readonly onArchive: () => void;
  readonly onExport: () => void;
  readonly busy?: boolean;
}

export const SessionSelectionBar: FC<SessionSelectionBarProps> = ({
  selectedCount,
  allSelected,
  onToggleAll,
  onDelete,
  onArchive,
  onExport,
  busy = false,
}) => {
  const { t } = useTranslation('sidebar');
  return (
    <div className="session-selection-bar">
      <span className="session-selection-count">
        {t('selectedCount', { count: selectedCount })}
      </span>
      <button
        type="button"
        aria-label={allSelected ? t('clearSelected') : t('selectAllSessions')}
        onClick={onToggleAll}
        className="session-selection-action"
      >
        <CheckCheck className="size-3" />
        {allSelected ? t('clear', { ns: 'common' }) : t('all')}
      </button>
      <button
        type="button"
        aria-label={t('archiveSelected')}
        disabled={busy || selectedCount === 0}
        onClick={onArchive}
        className="session-selection-action"
      >
        <Archive className="size-3" />
        {t('archiveAction')}
      </button>
      <button
        type="button"
        aria-label={t('exportSelected')}
        disabled={busy || selectedCount === 0}
        onClick={onExport}
        className="session-selection-action"
      >
        <Download className="size-3" />
        {t('exportAction')}
      </button>
      <button
        type="button"
        aria-label={t('deleteSelected')}
        disabled={busy || selectedCount === 0}
        onClick={onDelete}
        className="session-selection-delete"
      >
        <Trash2 className="size-3" />
        {t('delete', { ns: 'common' })}
      </button>
    </div>
  );
};
