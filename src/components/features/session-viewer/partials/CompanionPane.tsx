import { useTranslation } from 'react-i18next';

import { AnimatePresence, motion } from 'motion/react';

import { drawerTransition, PaneDivider } from '@ui/index';

import { FileEditsPanel } from './FileEditsPanel';
import { MessageNavigator } from './MessageNavigator';

import type { AgentId } from '@config/agents';
import type { AsyncStatus } from '@features/history-data';
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
  // The session's agent, for the navigator's assistant rows.
  readonly agent: AgentId;
  readonly profile?: string | undefined;
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
  readonly editsStatus: AsyncStatus;
  readonly editsError?: string | undefined;
}

// The resize handle's own width, added so the slide-in reveals the panel flush.
const DIVIDER_WIDTH = 8;

export const MIN_COMPANION_WIDTH = 220;
export const MAX_COMPANION_WIDTH = 420;

export const CompanionPane: FC<CompanionPaneProps> = ({
  panel,
  width,
  agent,
  profile,
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

  return (
    <AnimatePresence initial={false}>
      {panel !== 'none' && (
        <motion.div
          key={panel}
          className="flex h-full shrink-0 overflow-hidden"
          initial={{
            width: 0,
            opacity: 0,
          }}
          animate={{
            width: width + DIVIDER_WIDTH,
            opacity: 1,
          }}
          exit={{
            width: 0,
            opacity: 0,
          }}
          transition={drawerTransition}
          data-companion-pane={panel}
        >
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
                  agent={agent}
                  profile={profile}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};
