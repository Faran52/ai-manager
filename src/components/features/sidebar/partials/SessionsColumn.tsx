import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ListChecks,
  MessagesSquare,
  PanelLeft,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { toggleInArray } from '@utils/arrayUtils';

import {
  collapseTransition,
  IconButton,
  SectionHeader,
  TextInput,
  useReducedMotion,
} from '@ui/index';

import { useBulkActions } from '../hooks/useBulkActions';
import { groupSessionsByRecency } from '../utils/sessionGroupUtils';
import { titleOf } from '../utils/sessionRowUtils';
import { buildSessionThreads } from '../utils/sessionThreadUtils';

import { CollapsedStrip } from './CollapsedStrip';
import { FoldingColumn } from './FoldingColumn';
import { FunnelMenu } from './FunnelMenu';
import { SessionList } from './SessionList';
import { SessionSelectionBar } from './SessionSelectionBar';

import type { AsyncStatus } from '@features/history-data';
import type { SessionSummary } from '@services/history/historyService';
import type {
  FC,
  MouseEvent,
  ReactNode,
} from 'react';
import type { SessionFilters } from '../hooks/useSessionFilters';
import type { SessionSelection } from '../hooks/useSessionSelection';
import type { RecencyBucket } from '../utils/sessionGroupUtils';
import type { SessionRow } from '../utils/sessionThreadUtils';
import type { StripItem } from './CollapsedStrip';

export interface SessionsColumnProps {
  readonly open: boolean;
  readonly width: number;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly sessions: readonly SessionSummary[];
  readonly sessionsStatus: AsyncStatus;
  // A project or a report agent is picked; without one there is nothing to list.
  readonly scoped: boolean;
  // What an export file is named for; undefined falls back to a generic name.
  readonly scopeName: string | undefined;
  readonly filters: SessionFilters;
  readonly selection: SessionSelection;
  readonly selectedFilePath: string | null;
  // Set only once rows can span more than one project (a report agent's own).
  readonly projectNames: ReadonlyMap<string, string> | null;
  readonly nowMs: number;
  readonly onSelectSession: (session: SessionSummary) => void;
  readonly onOpenMenu: (event: MouseEvent, session: SessionSummary) => void;
  readonly onDeleteSessions: (sessions: readonly SessionSummary[]) => void;
}

// A reduced-motion reader gets the end state with no travel, same as Disclosure.
const INSTANT = { duration: 0 };

// The right column: the session list, its filters, and the selection bar over it.
export const SessionsColumn: FC<SessionsColumnProps> = ({
  open,
  width,
  onOpen,
  onClose,
  sessions,
  sessionsStatus,
  scoped,
  scopeName,
  filters,
  selection,
  selectedFilePath,
  projectNames,
  nowMs,
  onSelectSession,
  onOpenMenu,
  onDeleteSessions,
}) => {
  const { t } = useTranslation('sidebar');
  const reduceMotion = useReducedMotion();
  // One disclosure timing for the thread parts, the groups and the selection bar.
  const collapse = reduceMotion ? INSTANT : collapseTransition;
  const [expandedThreads, setExpandedThreads] = useState<readonly string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<readonly RecencyBucket[]>([]);
  const bulk = useBulkActions(selection.selectedSessions, scopeName);

  // Resuming or compacting a session writes a fresh transcript, so one piece of
  // work arrives as several files, shown as one row that opens to its parts.
  const rows = useMemo((): readonly SessionRow[] => {
    return buildSessionThreads(filters.visibleSessions, filters.order).flatMap((thread) => {
      const head = {
        session: thread.head,
        threadKey: thread.key,
        partCount: thread.parts.length,
        messageCount: thread.messageCount,
        continuation: false,
      };

      if (thread.parts.length === 1 || !expandedThreads.includes(thread.key)) {
        return [head];
      }

      return [head, ...thread.parts.slice(1).map((session) => {
        return {
          session,
          threadKey: thread.key,
          partCount: 1,
          messageCount: session.messageCount,
          continuation: true,
        };
      })];
    });
  }, [expandedThreads, filters.order, filters.visibleSessions]);

  const groups = useMemo(() => {
    return groupSessionsByRecency(rows, nowMs);
  }, [nowMs, rows]);

  const toggleThread = (key: string): void => {
    setExpandedThreads((current) => {
      return toggleInArray(current, key);
    });
  };

  const toggleGroup = (bucket: RecencyBucket): void => {
    setCollapsedGroups((current) => {
      return toggleInArray(current, bucket);
    });
  };

  const stripItems = (): readonly StripItem[] => {
    return rows.map((row) => {
      return {
        id: row.session.filePath,
        label: titleOf(row.session),
        agent: row.session.agent,
        selected: row.session.filePath === selectedFilePath,
        onSelect: (): void => {
          onSelectSession(row.session);
        },
      };
    });
  };

  // An icon like the fold toggle beside it, not a word: the header has room
  // for one control, and the tooltip carries the name.
  let headerAction: ReactNode;

  if (selection.active) {
    headerAction = (
      <IconButton
        label={t('cancelSelection')}
        icon={<X className="size-3.5" />}
        onClick={selection.exit}
      />
    );
  }
  else if (selection.selectableSessions.length > 0) {
    headerAction = (
      <IconButton
        label={t('selectSessions')}
        icon={<ListChecks className="size-3.5" />}
        onClick={selection.enter}
      />
    );
  }

  return (
    <FoldingColumn
      open={open}
      width={width}
      className="bg-background"
      exit={{
        width: 0,
        opacity: 0,
      }}
      strip={(
        <CollapsedStrip
          expandLabel={t('showSessions')}
          listLabel={t('sessions')}
          items={stripItems()}
          onExpand={onOpen}
        />
      )}
    >
      <SectionHeader
        icon={<MessagesSquare className="size-3.5" />}
        label={t('sessions')}
        count={sessions.length > 0 ? sessions.length : undefined}
        casing="plain"
        action={(
          <span className="flex items-center gap-1">
            {headerAction}
            <IconButton
              label={t('hideSessions')}
              icon={<PanelLeft className="size-3.5" />}
              onClick={onClose}
            />
          </span>
        )}
      />
      {/* Slides open under the header rather than popping the filter row
          down by its own height. */}
      <AnimatePresence initial={false}>
        {selection.active && (
          <motion.div
            key="selection-bar"
            initial={{
              height: 0,
              opacity: 0,
            }}
            animate={{
              height: 'auto',
              opacity: 1,
            }}
            exit={{
              height: 0,
              opacity: 0,
            }}
            transition={collapse}
            className="shrink-0 overflow-hidden"
          >
            <SessionSelectionBar
              selectedCount={selection.selectedSessions.length}
              allSelected={selection.allSelected}
              onToggleAll={selection.toggleAll}
              busy={bulk.busy}
              onDelete={() => {
                onDeleteSessions(selection.selectedSessions);
              }}
              onArchive={bulk.archiveSelected}
              onExport={bulk.exportSelected}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex shrink-0 items-center gap-1.5 px-3 pb-2">
        <TextInput
          value={filters.text}
          onInput={filters.setText}
          label={t('filterSessions')}
          placeholder={t('filterSessions')}
          disabled={!scoped}
          className="min-w-0 flex-1"
        />
        <FunnelMenu
          label={t('filterAndSortSessions')}
          dateFilter={filters.dateFilter}
          onDateFilterChange={filters.setDateFilter}
          order={filters.order}
          onOrderChange={filters.setOrder}
        />
      </div>
      <SessionList
        groups={groups}
        collapsedGroups={collapsedGroups}
        onToggleGroup={toggleGroup}
        collapse={collapse}
        status={sessionsStatus}
        scoped={scoped}
        total={sessions.length}
        visible={filters.visibleSessions.length}
        filtering={filters.filtering}
        context={{
          selectedFilePath,
          selecting: selection.active,
          selectedPaths: selection.selectedPaths,
          expandedThreads,
          projectNames,
          nowMs,
          reduceMotion,
          onToggleThread: toggleThread,
          onSelect: onSelectSession,
          onToggleSelection: selection.toggle,
          onOpenMenu,
        }}
      />
    </FoldingColumn>
  );
};
