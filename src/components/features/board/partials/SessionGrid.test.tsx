import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { buildBoardModel } from '../boardModel';

import { SessionGrid } from './SessionGrid';

import type { SessionSummary } from '@services/history/historyService';
import type { BoardAttribute } from '../boardModel';

const NOW = Date.parse('2026-08-28T12:00:00Z');

const session = (id: string, overrides: Partial<SessionSummary> = {}): SessionSummary => {
  return {
    agent: 'claude',
    actualSessionId: id,
    id,
    filePath: `/sessions/${id}.jsonl`,
    projectId: 'p',
    title: `Session ${id}`,
    messageCount: 10,
    firstTimestampMs: NOW - 600_000,
    lastTimestampMs: NOW - 60_000,
    modifiedMs: NOW,
    sizeBytes: 2_048,
    ...overrides,
  };
};

const renderGrid = (attribute: BoardAttribute, sessions: readonly SessionSummary[], onOpen = vi.fn()) => {
  render(
    <SessionGrid
      model={buildBoardModel(sessions, attribute, NOW)}
      attribute={attribute}
      nowMs={NOW}
      onOpenSession={onOpen}
    />,
  );

  return onOpen;
};

test('labels each cell with its title and the attribute in view', () => {
  renderGrid('messages', [session('a')]);

  expect(screen.getByLabelText('Session a, 10')).toBeDefined();
});

test('formats size, duration and recency in the label', () => {
  renderGrid('size', [session('a')]);
  expect(screen.getByLabelText('Session a, 2KB')).toBeDefined();

  renderGrid('duration', [session('b')]);
  expect(screen.getByLabelText('Session b, 9m')).toBeDefined();

  renderGrid('recency', [session('c')]);
  expect(screen.getByLabelText(/Session c, 1m ago/)).toBeDefined();
});

test('falls back to the session id when it has no title', () => {
  renderGrid('messages', [session('bare', {
    title: undefined,
    summary: undefined,
    preview: undefined,
  })]);

  expect(screen.getByLabelText('bare, 10')).toBeDefined();
});

test('opens the session it was clicked on', async () => {
  const onOpen = renderGrid('messages', [session('a')]);

  await userEvent.click(screen.getByLabelText('Session a, 10'));

  expect(onOpen).toHaveBeenCalledTimes(1);
});
