import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { fadeTransition } from '@ui/index';

import { blockIsVisible, defaultMessageFilters } from './messageFilters';
import {
  AssistantTurn,
  SummaryDivider,
  SystemNotice,
  UserTurn,
} from './partials';
import { buildTimelineModel, rowIndexForTimestamp } from './timelineRows';

import type { HistoryEntry, ToolOutcome } from '@services/history/historyService';
import type { FC } from 'react';
import type { MessageFilters } from './messageFilters';
import type { TimelineRow } from './timelineRows';

export interface MessageTimelineProps {
  readonly entries: readonly HistoryEntry[];
  readonly filters?: MessageFilters;
  readonly scrollElement?: HTMLDivElement | null;
  readonly highlightTimestamp?: string | undefined;
}

// A turn is roughly this tall before it is measured. Only the first paint leans
// on it, so being wrong costs a frame of scrollbar drift, not a layout bug.
const ESTIMATED_ROW_PX = 220;
const OVERSCAN = 6;

const renderEntry = (
  row: TimelineRow,
  pairs: ReadonlyMap<string, ToolOutcome>,
  orphans: ReadonlyMap<string, readonly ToolOutcome[]>,
  filters: MessageFilters,
) => {
  const { entry } = row;

  switch (entry.kind) {
    case 'user':
      return (
        <UserTurn
          entry={entry}
          orphans={orphans.get(entry.uuid) ?? []}
          filters={filters.content}
        />
      );
    case 'assistant':
      return (
        <AssistantTurn
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
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const ownScrollRef = useRef<HTMLDivElement>(null);
  const scrollMarginRef = useRef(0);
  const scrolledForRef = useRef<string | null>(null);

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
   * list that was rendering every row.
   */
  const virtualizer = useVirtualizer({
    count: model.rows.length,
    getScrollElement: () => {
      return scrollElement ?? ownScrollRef.current;
    },
    estimateSize: () => {
      return ESTIMATED_ROW_PX;
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

  return (
    <motion.div
      ref={ownScrollRef}
      className="space-y-4"
      data-message-timeline
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fadeTransition}
    >
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
                row.dimmed && 'opacity-60',
              )}
              style={{ transform: `translateY(${String(item.start - scrollMarginRef.current)}px)` }}
            >
              {renderEntry(row, model.pairs, model.orphans, filters)}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
