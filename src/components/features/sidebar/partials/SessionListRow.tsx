import { useTranslation } from 'react-i18next';

import { ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';

import { agentOption } from '@config/agents';

import { projectKeyOf } from '@services/history/historyService';
import { cn } from '@utils/cnUtils';
import { formatTimeAgo } from '@utils/formatUtils';

import { arriveInSequence, Tooltip } from '@ui/index';

import { previewOf, titleOf } from '../utils/sessionRowUtils';

import { LeadMark } from './LeadMark';

import type { SessionSummary } from '@services/history/historyService';
import type { FC, MouseEvent } from 'react';
import type { SessionRow } from '../utils/sessionThreadUtils';

/*
 * What every row in the list reads from the pane: which row is open, whether
 * the list is in selection mode, and where a click goes. One object rather
 * than a dozen props, since a thread group forwards it to each of its parts.
 */
export interface SessionRowContext {
  readonly selectedFilePath: string | null;
  readonly selecting: boolean;
  readonly selectedPaths: readonly string[];
  readonly expandedThreads: readonly string[];
  // Shown only once rows can span more than one project (a report agent's own).
  readonly projectNames: ReadonlyMap<string, string> | null;
  readonly nowMs: number;
  readonly reduceMotion: boolean;
  readonly onToggleThread: (key: string) => void;
  readonly onSelect: (session: SessionSummary) => void;
  readonly onToggleSelection: (session: SessionSummary) => void;
  readonly onOpenMenu: (event: MouseEvent, session: SessionSummary) => void;
}

export interface SessionListRowProps {
  readonly row: SessionRow;
  // A thread's later part, indented under its head.
  readonly continuation: boolean;
  // Position in the list, for the staggered arrival; parts arrive with their head.
  readonly index?: number;
  readonly context: SessionRowContext;
}

// The whole `<li>`: nested in a thread's own `<ul>` or standing directly in
// the session list, a row is styled the same either way.
export const SessionListRow: FC<SessionListRowProps> = ({
  row,
  continuation,
  index = 0,
  context,
}) => {
  const { t, i18n } = useTranslation('sidebar');
  const session = row.session;
  const active = session.filePath === context.selectedFilePath;
  const canDelete = agentOption(session.agent).canDelete;
  const selectedForDelete = context.selectedPaths.includes(session.filePath);
  const preview = previewOf(session);
  const threaded = row.partCount > 1;
  const open = context.expandedThreads.includes(row.threadKey);
  const highlighted = selectedForDelete || (!context.selecting && active);

  return (
    <motion.li
      className={cn('sidebar-row', continuation && 'ps-4', highlighted && `
        is-active
      `)}
      {...arriveInSequence(index)}
    >
      <LeadMark
        agent={session.agent}
        selecting={context.selecting}
        checked={selectedForDelete}
        reduceMotion={context.reduceMotion}
      />
      {/*
        Reserved on every row: a chevron that only sometimes exists shifts the
        title only sometimes. Same size as .sidebar-thread-toggle, empty when unused.
      */}
      <div className="flex size-4 shrink-0 items-center justify-center">
        {threaded && (
          <Tooltip content={t('threadParts', { count: row.partCount })}>
            <button
              type="button"
              aria-expanded={open}
              aria-label={t('threadParts', { count: row.partCount })}
              data-thread-toggle={row.threadKey}
              onClick={() => {
                context.onToggleThread(row.threadKey);
              }}
              className="sidebar-thread-toggle"
            >
              <ChevronDown className="size-3" />
            </button>
          </Tooltip>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <button
          type="button"
          onClick={() => {
            if (context.selecting) {
              context.onToggleSelection(session);
            }
            else {
              context.onSelect(session);
            }
          }}
          disabled={context.selecting && !canDelete}
          onContextMenu={(event) => {
            if (context.selecting) {
              event.preventDefault();
            }
            else {
              context.onOpenMenu(event, session);
            }
          }}
          aria-current={context.selecting ? undefined : active}
          aria-pressed={context.selecting ? selectedForDelete : undefined}
          data-session-item={session.filePath}
          className="flex min-w-0 flex-col gap-0.5 text-start"
        >
          <span className="flex w-full items-baseline gap-2">
            <span className="
              min-w-0 flex-1 truncate text-sm font-medium text-foreground
            "
            >
              {titleOf(session)}
            </span>
            <span className="shrink-0 font-mono text-figure text-faint">
              {formatTimeAgo(session.lastTimestampMs, context.nowMs, i18n.language)}
            </span>
          </span>
          {preview != null && (
            <span className="w-full truncate text-body text-muted-foreground">
              {preview}
            </span>
          )}
        </button>
        <span className="flex min-w-0 items-center gap-1">
          {context.projectNames != null && (
            <span className="
              min-w-0 truncate rounded-xs border border-border px-1 font-mono
              text-figure text-faint
            "
            >
              {context.projectNames.get(projectKeyOf(session.agent, session.projectId)) ?? session.projectId}
            </span>
          )}
          <span className="
            shrink-0 rounded-xs border border-border px-1 font-mono text-figure
            text-faint
          "
          >
            {t('messageCount', { count: row.messageCount })}
          </span>
        </span>
      </div>
    </motion.li>
  );
};
