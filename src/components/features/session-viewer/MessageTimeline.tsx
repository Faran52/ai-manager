import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { fadeTransition } from '@ui/index';

import {
  AssistantTurn,
  DateDivider,
  FloatingDate,
  SummaryDivider,
  SystemNotice,
  UserTurn,
} from './partials';
import { blockIsVisible, defaultMessageFilters } from './utils/messageFilterUtils';
import {
  buildTimelineModel,
  dayAtRow,
  rowIndexForTimestamp,
} from './utils/timelineUtils';

import type { HistoryEntry, ToolOutcome } from '@services/history/historyService';
import type { FC } from 'react';
import type { MessageFilters } from './utils/messageFilterUtils';
import type { TimelineRow } from './utils/timelineUtils';

export interface MessageTimelineProps {
  readonly entries: readonly HistoryEntry[];
  readonly filters?: MessageFilters;
  readonly scrollElement?: HTMLDivElement | null;
  readonly highlightTimestamp?: string | undefined;
  readonly navigation?: TimelineNavigation | null;
  readonly nowMs?: number;
}

export interface TimelineNavigation {
  readonly index: number;
}

/**
 * How tall each row is before it is measured. One number for every row made the
 * total height wrong by a wide margin on a mixed transcript, and the scrollbar
 * jumped as rows mounted and corrected it, so each kind estimates its own.
 */
const DATE_ROW_PX = 32;
const SUMMARY_ROW_PX = 56;
const SYSTEM_ROW_PX = 72;
const USER_ROW_PX = 104;
const ASSISTANT_BASE_PX = 64;
const ASSISTANT_BLOCK_PX = 120;
const OVERSCAN = 6;

const estimateRow = (row: TimelineRow | undefined): number => {
  /* v8 ignore next 3 -- the virtualizer only asks about indexes within its own count */
  if (row == null) {
    return USER_ROW_PX;
  }

  if (row.kind === 'date') {
    return DATE_ROW_PX;
  }

  switch (row.entry.kind) {
    case 'user':
      return USER_ROW_PX;
    case 'assistant':
      return ASSISTANT_BASE_PX + row.entry.blocks.length * ASSISTANT_BLOCK_PX;
    case 'system':
      return SYSTEM_ROW_PX;
    case 'summary':
      return SUMMARY_ROW_PX;
  }
};

const renderRow = (
  row: TimelineRow,
  pairs: ReadonlyMap<string, ToolOutcome>,
  orphans: ReadonlyMap<string, readonly ToolOutcome[]>,
  filters: MessageFilters,
  nowMs: number,
) => {
  if (row.kind === 'date') {
    return <DateDivider timestampMs={row.timestampMs} nowMs={nowMs} />;
  }

  const { entry } = row;

  switch (entry.kind) {
    case 'user':
      return (
        <UserTurn
          entry={entry}
          orphans={orphans.get(entry.uuid) ?? []}
          filters={filters.content}
          showHeader={!row.continues}
        />
      );
    case 'assistant':
      return (
        <AssistantTurn
          entry={entry}
          visibleBlocks={entry.blocks.filter((block) => {
            return blockIsVisible(block, filters);
          })}
          hiddenCount={entry.blocks.length - entry.blocks.filter((block) => {
            return blockIsVisible(block, filters);
          }).length}
          outcomeFor={(toolUseId) => {
            return pairs.get(toolUseId);
          }}
          showHeader={!row.continues}
        />
      );
    case 'system':
      return <SystemNotice entry={entry} />;
    case 'summary':
      return <SummaryDivider text={entry.text} />;
  }
};

export const MessageTimeline: FC<MessageTimelineProps> = ({
  entries,
  filters = defaultMessageFilters(),
  scrollElement,
  highlightTimestamp,
  navigation,
  nowMs: nowMsProp,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const ownScrollRef = useRef<HTMLDivElement>(null);
  const scrollMarginRef = useRef(0);
  const scrolledForRef = useRef<string | null>(null);

  // Frozen on mount so the day labels do not shift while the timeline is open.
  const [mountedNowMs] = useState(() => {
    return Date.now();
  });
  const nowMs = nowMsProp ?? mountedNowMs;

  const model = useMemo(() => {
    return buildTimelineModel(entries, filters);
  }, [entries, filters]);

  /**
   * The list starts below whatever the viewer draws above it, and the
   * virtualizer measures against the scroll box, so it needs that offset. Held
   * in a ref rather than state: writing state here would re-render on mount for
   * a value the next render reads anyway.
   */
  useLayoutEffect(() => {
    /* v8 ignore next -- the ref is attached before layout effects run */
    scrollMarginRef.current = listRef.current?.offsetTop ?? 0;
  }, [model.rows.length]);

  /**
   * React Compiler cannot memoize a component holding a virtualizer, because the
   * hook hands back functions whose identity has to change as scroll state does.
   * Skipping compilation here is the trade: measured windowing beats memoizing a
   * list that was rendering every row. The lint rule that reports the skip is
   * turned off for this file in eslint.config.js.
   */
  const virtualizer = useVirtualizer({
    count: model.rows.length,
    getScrollElement: () => {
      return scrollElement ?? ownScrollRef.current;
    },
    estimateSize: (index) => {
      return estimateRow(model.rows[index]);
    },
    getItemKey: (index) => {
      /* v8 ignore next -- the virtualizer only asks about indexes within its own count */
      return model.rows[index]?.key ?? index;
    },
    overscan: OVERSCAN,
    scrollMargin: scrollMarginRef.current,
  });

  // Search hands us a timestamp, not a position, and the target row may not be
  // mounted, so the jump goes through the virtualizer rather than the DOM.
  useEffect(() => {
    if (highlightTimestamp == null || scrolledForRef.current === highlightTimestamp) {
      return;
    }

    const index = rowIndexForTimestamp(model.rows, highlightTimestamp);

    if (index < 0) {
      return;
    }

    virtualizer.scrollToIndex(index, { align: 'center' });
    scrolledForRef.current = highlightTimestamp;
  }, [highlightTimestamp, model.rows, virtualizer]);

  useEffect(() => {
    if (navigation != null) {
      virtualizer.scrollToIndex(navigation.index, { align: 'center' });
    }
  }, [navigation, virtualizer]);

  const firstVisible = virtualizer.getVirtualItems()[0];
  // A separator on screen already names the day; the pill is for when it is not.
  const floatingDay = firstVisible == null || model.rows[firstVisible.index]?.kind === 'date'
    ? 0
    : dayAtRow(model.rows, firstVisible.index);

  return (
    <motion.div
      ref={ownScrollRef}
      className="relative space-y-4"
      data-message-timeline
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fadeTransition}
    >
      <FloatingDate timestampMs={floatingDay} nowMs={nowMs} />
      <div
        ref={listRef}
        className="relative w-full"
        style={{ height: `${String(virtualizer.getTotalSize())}px` }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const row = model.rows[item.index];

          /* v8 ignore next 3 -- the virtualizer never indexes past its own count */
          if (row == null) {
            return null;
          }

          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className={cn(
                'absolute top-0 left-0 w-full pb-4 transition-opacity',
                row.kind === 'entry' && row.dimmed && 'opacity-60',
              )}
              style={{ transform: `translateY(${String(item.start - scrollMarginRef.current)}px)` }}
            >
              {renderRow(row, model.pairs, model.orphans, filters, nowMs)}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
