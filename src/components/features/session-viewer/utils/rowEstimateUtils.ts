import {
  ASSISTANT_BASE_PX,
  ASSISTANT_BLOCK_PX,
  DATE_ROW_PX,
  SUMMARY_ROW_PX,
  SYSTEM_ROW_PX,
  USER_ROW_PX,
} from '../constants';

import type { TimelineRow } from './timelineUtils';

/**
 * How tall each row is before it is measured. One number for every row made the
 * total height wrong by a wide margin on a mixed transcript, and the scrollbar
 * jumped as rows mounted and corrected it, so each kind estimates its own.
 */
export const estimateRow = (row: TimelineRow | undefined): number => {
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
