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

import { fadeTransition, useReducedMotion } from '@ui/index';

import { OVERSCAN } from './constants';
import { FloatingDate, TimelineRowBody } from './partials';
import { defaultMessageFilters } from './utils/messageFilterUtils';
import { estimateRow } from './utils/rowEstimateUtils';
import {
  buildTimelineModel,
  dayAtRow,
  rowIndexForTimestamp,
} from './utils/timelineUtils';

import type { AgentId } from '@config/agents';
import type { HistoryEntry } from '@services/history/historyService';
import type { FC } from 'react';
import type { MessageFilters } from './utils/messageFilterUtils';

export interface MessageTimelineProps {
  readonly entries: readonly HistoryEntry[];
  // The session's agent, so each assistant turn's mark carries its hue.
  readonly agent: AgentId;
  readonly profile?: string | undefined;
  readonly filters?: MessageFilters;
  readonly scrollElement?: HTMLDivElement | null;
  readonly highlightTimestamp?: string | undefined;
  readonly navigation?: TimelineNavigation | null;
  readonly nowMs?: number;
}

export interface TimelineNavigation {
  readonly index: number;
}

export const MessageTimeline: FC<MessageTimelineProps> = ({
  entries,
  agent,
  profile,
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
  const reduceMotion = useReducedMotion();

  // Frozen on mount so the day labels do not shift while the timeline is open.
  const [mountedNowMs] = useState(() => {
    return Date.now();
  });
  const nowMs = nowMsProp ?? mountedNowMs;

  const model = useMemo(() => {
    return buildTimelineModel(entries, filters);
  }, [entries, filters]);

  /*
   * The virtualizer measures against the scroll box, so it needs the offset of
   * whatever the viewer draws above. A ref, because state would re-render on
   * mount for a value the next render reads anyway.
   */
  useLayoutEffect(() => {
    /* v8 ignore next -- the ref is attached before layout effects run */
    scrollMarginRef.current = listRef.current?.offsetTop ?? 0;
  }, [model.rows.length]);

  /*
   * React Compiler cannot memoize a component holding a virtualizer: the hook
   * hands back functions whose identity has to change as scroll state does.
   * The rule reporting the skip is off for this file in eslint.config.js.
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

  /**
   * A click in the navigator is a deliberate jump the reader is following with
   * their eyes, so it glides to the row rather than teleporting to it. Search,
   * which lands on a row the reader has not seen, still snaps (above).
   */
  useEffect(() => {
    if (navigation != null) {
      virtualizer.scrollToIndex(navigation.index, {
        align: 'center',
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    }
  }, [navigation, reduceMotion, virtualizer]);

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

          /**
           * A hairline between adjacent turns, the way the mock separates them. A
           * date row in between already breaks the run, and a turn that continues
           * the same speaker stays in the same block, so neither takes a rule.
           */
          const previous = model.rows[item.index - 1];
          const next = model.rows[item.index + 1];
          const dividedFromPrevious = row.kind === 'entry'
            && !row.continues
            && previous?.kind === 'entry';
          // A continued turn sits tight against the one it extends, at both ends:
          // its own top, and the bottom of the row above it.
          const openTight = row.kind === 'entry' && row.continues;
          const closeTight = next?.kind === 'entry' && next.continues;

          return (
            <div
              key={item.key}
              ref={virtualizer.measureElement}
              data-index={item.index}
              className={cn(
                'absolute top-0 left-0 w-full transition-opacity',
                openTight ? 'pt-1.5' : 'pt-3.5',
                closeTight ? 'pb-1.5' : 'pb-3.5',
                dividedFromPrevious && 'border-t border-hair',
                row.kind === 'entry' && row.dimmed && 'opacity-60',
              )}
              style={{ transform: `translateY(${String(item.start - scrollMarginRef.current)}px)` }}
            >
              <TimelineRowBody
                row={row}
                pairs={model.pairs}
                orphans={model.orphans}
                filters={filters}
                nowMs={nowMs}
                agent={agent}
                profile={profile}
              />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
