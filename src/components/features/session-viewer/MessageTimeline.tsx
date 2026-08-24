import { useMemo } from 'react';

import { motion } from 'motion/react';

import { pairToolOutcomes } from '@services/history/historyService';
import { cn } from '@utils/cnUtils';
import { uniqueKeys } from '@utils/reactKeyUtils';

import { fadeTransition } from '@ui/index';

import {
  blockIsVisible,
  defaultMessageFilters,
  entryIsVisible,
} from './messageFilters';
import {
  AssistantTurn,
  SummaryDivider,
  SystemNotice,
  UserTurn,
} from './partials';

import type { HistoryEntry, ToolOutcome } from '@services/history/historyService';
import type { FC } from 'react';
import type { MessageFilters } from './messageFilters';

export interface MessageTimelineProps {
  readonly entries: readonly HistoryEntry[];
  readonly filters?: MessageFilters;
}

const entryIdentity = (entry: HistoryEntry): string => {
  return entry.kind === 'summary' ? `summary-${entry.text}` : `${entry.kind}-${entry.uuid}`;
};

const renderEntry = (
  entry: HistoryEntry,
  rowKey: string | undefined,
  pairs: ReadonlyMap<string, ToolOutcome>,
  orphans: ReadonlyMap<string, readonly ToolOutcome[]>,
  filters: MessageFilters,
) => {
  switch (entry.kind) {
    case 'user':
      return (
        <UserTurn
          key={`${entry.kind}-${entry.uuid}`}
          entry={entry}
          orphans={orphans.get(entry.uuid) ?? []}
          filters={filters.content}
        />
      );
    case 'assistant':
      return (
        <AssistantTurn
          key={`${entry.kind}-${entry.uuid}`}
          entry={entry}
          visibleBlocks={entry.blocks.filter((block) => {
            return blockIsVisible(block, filters);
          })}
          outcomeFor={(toolUseId) => {
            return pairs.get(toolUseId);
          }}
        />
      );
    case 'system':
      return <SystemNotice key={`${entry.kind}-${entry.uuid}`} entry={entry} />;
    case 'summary':
      return <SummaryDivider key={rowKey} text={entry.text} />;
  }
};

export const MessageTimeline: FC<MessageTimelineProps> = ({ entries, filters = defaultMessageFilters() }) => {
  const rowKeys = useMemo(() => {
    return uniqueKeys(entries, entryIdentity);
  }, [entries]);
  const pairs = useMemo(() => {
    return pairToolOutcomes(entries);
  }, [entries]);
  const orphans = useMemo(() => {
    const map = new Map<string, readonly ToolOutcome[]>();

    for (const entry of entries) {
      if (entry.kind !== 'user' || entry.outcomes.length === 0) {
        continue;
      }

      map.set(entry.uuid, entry.outcomes.filter((outcome) => {
        return !pairs.has(outcome.toolUseId);
      }));
    }

    return map;
  }, [entries, pairs]);

  return (
    <motion.div
      className="space-y-4"
      data-message-timeline
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fadeTransition}
    >
      {entries.map((entry, index) => {
        const hidden = entry.kind !== 'summary' && entry.sidechain;

        if (!entryIsVisible(entry, filters)) {
          return null;
        }

        return (
          <div
            key={rowKeys[index]}
            className={cn('transition-opacity', hidden && 'opacity-60')}
          >
            {renderEntry(entry, rowKeys[index], pairs, orphans, filters)}
          </div>
        );
      })}
    </motion.div>
  );
};
