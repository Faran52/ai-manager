import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  expect,
  test,
  vi,
} from 'vitest';

import { BoardPanels } from './BoardPanels';

import type { AsyncResource } from '@features/history-data';
import type { EditedFile, FileEdit } from '@services/edits/editsService';
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

const FILE: EditedFile = {
  path: '/repo/src/a.ts',
  edits: 2,
  writes: 0,
  sessionCount: 1,
  lastEditedMs: NOW - 60_000,
  recent: [{
    kind: 'edit',
    sessionId: 's1',
    sessionTitle: 'Login fix',
    sessionFilePath: '/sessions/s1.jsonl',
    timestampMs: NOW - 60_000,
    changes: 2,
  }],
};

const editsResource = (
  status: AsyncResource<readonly EditedFile[]>['status'],
  data: readonly EditedFile[] | undefined,
  error?: string,
): AsyncResource<readonly EditedFile[]> => {
  return {
    status,
    data,
    error,
    reload: noop,
  };
};

const renderBoard = (overrides: {
  readonly panel?: 'sessions' | 'edits';
  readonly project?: string | undefined;
  readonly sessions?: readonly SessionSummary[];
  readonly sessionsStatus?: 'loading' | 'ready' | 'error';
  readonly edits?: AsyncResource<readonly EditedFile[]>;
  readonly onOpenSession?: (session: SessionSummary) => void;
  readonly onOpenEdit?: (edit: FileEdit) => void;
} = {}): void => {
  render(
    <BoardPanels
      panel={overrides.panel ?? 'sessions'}
      project={'project' in overrides ? overrides.project : '/repo'}
      sessions={overrides.sessions ?? [session('a', 10), session('b', 5)]}
      sessionsStatus={overrides.sessionsStatus ?? 'ready'}
      edits={overrides.edits ?? editsResource('ready', [FILE])}
      nowMs={NOW}
      onOpenSession={overrides.onOpenSession ?? noop}
      onOpenEdit={overrides.onOpenEdit ?? noop}
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
    <BoardPanels
      panel="sessions"
      project="/repo"
      sessions={[]}
      sessionsStatus="loading"
      edits={editsResource('ready', [])}
      nowMs={NOW}
      onOpenSession={noop}
      onOpenEdit={noop}
    />,
  );

  expect(screen.queryByText('This project has no sessions yet')).toBeNull();
  unmount();

  renderBoard({
    sessions: [],
    sessionsStatus: 'ready',
  });
  expect(screen.getByText('This project has no sessions yet')).toBeDefined();
});

test('shows the files those sessions changed', async () => {
  const onOpenEdit = vi.fn();

  renderBoard({
    panel: 'edits',
    onOpenEdit,
  });

  expect(screen.getByText('src/a.ts')).toBeDefined();
  expect(screen.queryByText('Sessions per day')).toBeNull();

  await userEvent.click(screen.getByText('src/a.ts'));
  await userEvent.click(screen.getByText('Login fix'));

  expect(onOpenEdit).toHaveBeenCalledTimes(1);
});

test('names a file in full when no project shortens it', () => {
  renderBoard({
    panel: 'edits',
    project: undefined,
  });

  expect(screen.getByText('/repo/src/a.ts')).toBeDefined();
});

test('waits for the edit scan and says when it found nothing', () => {
  const { unmount } = render(
    <BoardPanels
      panel="edits"
      project="/repo"
      sessions={[]}
      sessionsStatus="ready"
      edits={editsResource('loading', undefined)}
      nowMs={NOW}
      onOpenSession={noop}
      onOpenEdit={noop}
    />,
  );

  expect(screen.queryByText('No file edits found')).toBeNull();
  unmount();

  renderBoard({
    panel: 'edits',
    edits: editsResource('ready', []),
  });
  expect(screen.getByText('No file edits found')).toBeDefined();
});

test('reports a failed edit scan', () => {
  renderBoard({
    panel: 'edits',
    edits: editsResource('error', undefined, 'transcripts unreadable'),
  });

  expect(screen.getByText('transcripts unreadable')).toBeDefined();
});
