import { useTranslation } from 'react-i18next';

import { PaneDivider } from '@ui/index';

import { FileEditsPanel } from './FileEditsPanel';
import { MessageNavigator } from './MessageNavigator';

import type { EditedFile, FileEdit } from '@services/edits/editsService';
import type { HistoryEntry } from '@services/history/historyService';
import type { FC } from 'react';
import type { MessageFilters } from '../utils/messageFilterUtils';

/*
 * One companion panel at a time. Both belong to the session on screen and both
 * want the same strip of width, so opening one closes the other rather than
 * squeezing the transcript down to a gutter.
 */
export type CompanionPanel = 'none' | 'navigator' | 'edits';

export interface CompanionPaneProps {
  readonly panel: CompanionPanel;
  readonly width: number;
  readonly entries: readonly HistoryEntry[];
  readonly filters: MessageFilters;
  readonly editedFiles: readonly EditedFile[];
  readonly projectPath: string | undefined;
  readonly nowMs: number;
  readonly onResize: (delta: number) => void;
  readonly onNavigate: (index: number) => void;
  readonly onOpenEdit: ((edit: FileEdit) => void)
    | undefined;
  readonly onClose: () => void;
  readonly editsStatus: 'loading' | 'ready' | 'error';
  readonly editsError?: string | undefined;
}

export const MIN_COMPANION_WIDTH = 220;
export const MAX_COMPANION_WIDTH = 420;

export const CompanionPane: FC<CompanionPaneProps> = ({
  panel,
  width,
  entries,
  filters,
  editedFiles,
  projectPath,
  nowMs,
  onResize,
  onNavigate,
  onOpenEdit,
  onClose,
  editsStatus,
  editsError,
}) => {
  const { t } = useTranslation('session');

  if (panel === 'none') {
    return null;
  }

  return (
    <>
      <PaneDivider
        label={t('resizeMessageNavigator')}
        value={width}
        min={MIN_COMPANION_WIDTH}
        max={MAX_COMPANION_WIDTH}
        orientation="horizontal"
        onResize={onResize}
      />
      {panel === 'navigator'
        ? (
            <MessageNavigator
              entries={entries}
              filters={filters}
              width={width}
              onNavigate={onNavigate}
              onClose={onClose}
            />
          )
        : (
            <FileEditsPanel
              files={editedFiles}
              projectPath={projectPath}
              width={width}
              nowMs={nowMs}
              status={editsStatus}
              error={editsError}
              onOpenEdit={onOpenEdit}
              onClose={onClose}
            />
          )}
    </>
  );
};
