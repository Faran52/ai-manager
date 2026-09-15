import { useMemo, useState } from 'react';

import { withinDateFilter } from '../utils/dateFilterUtils';

import type { SessionSummary } from '@services/history/historyService';
import type { FunnelOrder } from '../partials/FunnelMenu';
import type { DateFilter } from '../utils/dateFilterUtils';

export interface SessionFilters {
  readonly text: string;
  readonly setText: (text: string) => void;
  readonly dateFilter: DateFilter;
  readonly setDateFilter: (filter: DateFilter) => void;
  readonly order: FunnelOrder;
  readonly setOrder: (order: FunnelOrder) => void;
  // True while the text box narrows the list, so an empty result can say so.
  readonly filtering: boolean;
  readonly visibleSessions: readonly SessionSummary[];
}

// The session list's text box, date range and sort, and the sessions that survive them.
export const useSessionFilters = (
  sessions: readonly SessionSummary[],
  nowMs: number,
): SessionFilters => {
  const [text, setText] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [order, setOrder] = useState<FunnelOrder>('newest');

  const visibleSessions = useMemo(() => {
    const needle = text.trim().toLowerCase();

    return sessions.filter((session) => {
      if (!withinDateFilter(session.lastTimestampMs, dateFilter, nowMs)) {
        return false;
      }

      if (needle.length === 0) {
        return true;
      }

      return [
        session.title,
        session.summary,
        session.preview,
        session.gitBranch,
      ].join(' ').toLowerCase().includes(needle);
    });
  }, [dateFilter, nowMs, sessions, text]);

  return {
    text,
    setText,
    dateFilter,
    setDateFilter,
    order,
    setOrder,
    filtering: text.trim().length > 0,
    visibleSessions,
  };
};
