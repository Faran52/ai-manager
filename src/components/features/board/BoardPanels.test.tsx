import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { BoardPanels } from './BoardPanels';

import type { SessionSummary } from '@services/history/historyService';

const NOW = Date.parse('2026-08-28T12:00:00Z');

const noop = (): void => {
  return undefined;
};

const session = (id: string, messageCount: number): SessionSummary => {
  return {
    agent: 'claude',
    actualSessionId: id,
    id,
    filePath: `/sessions/${id}.jsonl`,
    projectId: 'proj',
    title: `Session ${id}`,
    messageCount,
    firstTimestampMs: NOW - 600_000,
    lastTimestampMs: NOW - 60_000,
    modifiedMs: NOW,
    sizeBytes: 1_024,
  };
};

const renderBoard = (overrides: {
  readonly sessions?: readonly SessionSummary[];
  readonly sessionsStatus?: 'loading' | 'ready' | 'error';
  readonly onOpenSession?: (session: SessionSummary) => void;
} = {}): void => {
  render(
    <BoardPanels
      sessions={overrides.sessions ?? [session('a', 10), session('b', 5)]}
      sessionsStatus={overrides.sessionsStatus ?? 'ready'}
      nowMs={NOW}
      onOpenSession={overrides.onOpenSession ?? noop}
    />,
  );
};

test('lays the sessions out with a timeline under them', () => {
  renderBoard();

  expect(screen.getByLabelText('Session a, 10')).toBeDefined();
  expect(screen.getByText('Sessions per day')).toBeDefined();
});

test('highlights the grid by another measure', async () => {
  renderBoard();

  await userEvent.click(screen.getByRole('button', { name: 'Transcript size' }));

  expect(screen.getByLabelText('Session a, 1KB')).toBeDefined();
});

test('opens a session from the grid', async () => {
  const onOpenSession = vi.fn();

  renderBoard({ onOpenSession });
  await userEvent.click(screen.getByLabelText('Session a, 10'));

  expect(onOpenSession).toHaveBeenCalledTimes(1);
});

test('waits for sessions and says when there are none', () => {
  const { unmount } = render(
    <BoardPanels sessions={[]} sessionsStatus="loading" nowMs={NOW} onOpenSession={noop} />,
  );

  expect(screen.queryByText('This project has no sessions yet')).toBeNull();
  unmount();

  renderBoard({
    sessions: [],
    sessionsStatus: 'ready',
  });
  expect(screen.getByText('This project has no sessions yet')).toBeDefined();
});
