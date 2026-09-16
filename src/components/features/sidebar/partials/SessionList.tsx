import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ChevronDown,
  FolderClosed,
  MessagesSquare,
  Search,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { EmptyState, Spinner } from '@ui/index';

import { groupThreadRuns } from '../utils/sessionThreadUtils';

import { SessionListRow } from './SessionListRow';
import { SessionThreadGroup } from './SessionThreadGroup';

import type { AsyncStatus } from '@features/history-data';
import type { Transition } from 'motion/react';
import type { FC } from 'react';
import type { RecencyBucket, RecencyGroup } from '../utils/sessionGroupUtils';
import type { SessionRow } from '../utils/sessionThreadUtils';
import type { SessionRowContext } from './SessionListRow';

export interface SessionListProps {
  readonly groups: readonly RecencyGroup<SessionRow>[];
  readonly collapsedGroups: readonly RecencyBucket[];
  readonly onToggleGroup: (bucket: RecencyBucket) => void;
  readonly context: SessionRowContext;
  readonly collapse: Transition;
  readonly status: AsyncStatus;
  // A project or a report agent is picked; without one there is nothing to list.
  readonly scoped: boolean;
  // How many sessions the scope holds before the filters, and after them.
  readonly total: number;
  readonly visible: number;
  readonly filtering: boolean;
}

const BUCKET_LABEL: Record<RecencyBucket, string> = {
  today: 'recencyToday',
  week: 'recencyWeek',
  earlier: 'recencyEarlier',
};

// The scrolling list: recency groups that open and shut, and the states where
// there is nothing to list yet.
export const SessionList: FC<SessionListProps> = ({
  groups,
  collapsedGroups,
  onToggleGroup,
  context,
  collapse,
  status,
  scoped,
  total,
  visible,
  filtering,
}) => {
  const { t } = useTranslation('sidebar');

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
      {groups.map((group) => {
        const shut = collapsedGroups.includes(group.bucket);

        return (
          <Fragment key={group.bucket}>
            <li>
              <button
                type="button"
                aria-expanded={!shut}
                data-session-group={group.bucket}
                onClick={() => {
                  onToggleGroup(group.bucket);
                }}
                className="
                  flex w-full items-center gap-1.5 px-2 pt-3 pb-1 text-body
                  font-semibold text-muted-foreground
                  hover:text-foreground
                "
              >
                <ChevronDown className={cn('size-3 transition-transform', shut && `
                  -rotate-90
                `)}
                />
                {t(BUCKET_LABEL[group.bucket])}
                <span className="ms-auto font-mono text-figure text-faint">{group.count}</span>
              </button>
            </li>
            {/* The group opens and shuts on the same disclosure motion as a
                thread, rather than cutting. */}
            <AnimatePresence initial={false}>
              {!shut && (
                <motion.li
                  key="rows"
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
                  className="overflow-hidden"
                >
                  <ul>
                    {groupThreadRuns(group.rows).map(({ head, parts }, index) => {
                      /*
                       * partCount, not parts.length: a collapsed thread has no
                       * parts to render yet but still needs the stable,
                       * animatable wrapper so expanding it can transition in.
                       */
                      return head.partCount > 1
                        ? (
                            <SessionThreadGroup
                              key={head.threadKey}
                              head={head}
                              parts={parts}
                              context={context}
                              collapse={collapse}
                            />
                          )
                        : (
                            <SessionListRow
                              key={head.session.filePath}
                              row={head}
                              continuation={false}
                              index={index}
                              context={context}
                            />
                          );
                    })}
                  </ul>
                </motion.li>
              )}
            </AnimatePresence>
          </Fragment>
        );
      })}
      {status === 'loading' && (
        <li className="flex justify-center py-4">
          <Spinner />
        </li>
      )}
      {status === 'ready' && !scoped && (
        <EmptyState
          icon={<FolderClosed className="size-8" />}
          title={t('selectProject')}
          hint={t('selectProjectHint')}
        />
      )}
      {status === 'ready' && scoped && total === 0 && !filtering && (
        <EmptyState
          icon={<MessagesSquare className="size-8" />}
          title={t('noSessionsYet')}
          hint={t('noStoredSessions')}
        />
      )}
      {status === 'ready' && scoped && visible === 0 && (total > 0 || filtering) && (
        <EmptyState
          icon={<Search className="size-8" />}
          title={t('noSessionsMatch')}
          hint={t('adjustFilter')}
        />
      )}
    </ul>
  );
};
