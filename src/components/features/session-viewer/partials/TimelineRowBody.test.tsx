import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { defaultMessageFilters } from '../utils/messageFilterUtils';

import { TimelineRowBody } from './TimelineRowBody';

import type { HistoryEntry } from '@services/history/historyService';
import type { FC } from 'react';
import type { TimelineRow } from '../utils/timelineUtils';

const Row: FC<{ readonly row: TimelineRow }> = ({ row }) => {
  return (
    <TimelineRowBody
      row={row}
      pairs={new Map()}
      orphans={new Map()}
      filters={defaultMessageFilters()}
      nowMs={Date.UTC(2026, 4, 5)}
      agent="claude"
      profile={undefined}
    />
  );
};

const entryRow = (entry: HistoryEntry): TimelineRow => {
  return {
    kind: 'entry',
    entry,
    key: entry.kind,
    dimmed: false,
    continues: false,
  };
};

test('draws each row kind as its own turn or divider', () => {
  const { rerender } = render(
    <Row row={entryRow({
      kind: 'user',
      uuid: 'u',
      timestamp: '2026-05-05T10:00:00Z',
      sidechain: false,
      meta: false,
      text: 'the question',
      outcomes: [],
    })}
    />,
  );

  expect(screen.getByText('the question')).toBeDefined();

  rerender(
    <Row row={entryRow({
      kind: 'assistant',
      uuid: 'a',
      timestamp: '2026-05-05T10:01:00Z',
      sidechain: false,
      blocks: [{
        blockType: 'text',
        text: 'the answer',
      }],
    })}
    />,
  );
  expect(screen.getByText('the answer')).toBeDefined();

  rerender(
    <Row row={entryRow({
      kind: 'system',
      uuid: 's',
      timestamp: '2026-05-05T10:02:00Z',
      sidechain: false,
      text: 'hook ran',
    })}
    />,
  );
  expect(screen.getByText('hook ran')).toBeDefined();

  rerender(
    <Row row={entryRow({
      kind: 'summary',
      text: 'the recap',
    })}
    />,
  );
  expect(screen.getByText('the recap')).toBeDefined();

  rerender(
    <Row row={{
      kind: 'date',
      key: 'd',
      timestampMs: Date.UTC(2026, 4, 5),
    }}
    />,
  );
  expect(screen.queryByText('the recap')).toBeNull();
});
