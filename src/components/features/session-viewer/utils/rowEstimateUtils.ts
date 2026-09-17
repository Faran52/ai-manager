import {
  ASSISTANT_BASE_PX,
  ASSISTANT_BLOCK_PX,
  DATE_ROW_PX,
  PROSE_CHARS_PER_LINE,
  PROSE_LINE_PX,
  SUMMARY_ROW_PX,
  SYSTEM_ROW_PX,
  TOOL_USE_BLOCK_PX,
  USER_ROW_PX,
} from '../constants';

import type { AssistantBlock } from '@services/history/types';
import type { TimelineRow } from './timelineUtils';

/*
 * Hard line breaks, plus the lines each wraps into at the reader's width.
 *
 * ponytail: characters, not glyphs, and one width for every row. Only has to be
 * close enough that the total stops lurching, since the virtualizer measures
 * what it mounts. Check a real transcript before anything cleverer.
 */
const estimateText = (text: string): number => {
  const lines = text.split('\n').reduce((total, line) => {
    return total + Math.max(1, Math.ceil(line.length / PROSE_CHARS_PER_LINE));
  }, 0);

  return lines * PROSE_LINE_PX;
};

const estimateBlock = (block: AssistantBlock): number => {
  switch (block.blockType) {
    case 'text':
      return estimateText(block.text);
    case 'thinking':
      return estimateText(block.thinking);
    case 'tool-use':
      return TOOL_USE_BLOCK_PX;
    case 'redacted':
      return ASSISTANT_BLOCK_PX;
  }
};

/**
 * How tall each row is before it is measured. One number for every row made the
 * total height wrong by a wide margin on a mixed transcript, and the scrollbar
 * jumped as rows mounted and corrected it, so each kind estimates its own, and
 * the kinds that carry prose estimate from how much of it they carry.
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
      return USER_ROW_PX + estimateText(row.entry.text);
    case 'assistant':
      return ASSISTANT_BASE_PX + row.entry.blocks.reduce((total, block) => {
        return total + estimateBlock(block);
      }, 0);
    case 'system':
      return SYSTEM_ROW_PX;
    case 'summary':
      return SUMMARY_ROW_PX;
  }
};
