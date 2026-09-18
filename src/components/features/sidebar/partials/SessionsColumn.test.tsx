import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { ToastProvider } from '@ui/index';

import { fixtureSession } from '@mocks/sessionRowFixtures';

import { useSessionFilters } from '../hooks/useSessionFilters';
import { useSessionSelection } from '../hooks/useSessionSelection';

import { SessionsColumn } from './SessionsColumn';

import type { SessionSummary } from '@services/history/historyService';
import type { FC } from 'react';
import type { SessionsColumnProps } from './SessionsColumn';

interface HarnessSessions {
  readonly sessions?: readonly SessionSummary[];
}

type HarnessProps = Partial<Omit<SessionsColumnProps, 'filters' | 'selection'>> & HarnessSessions;

const noop = (): void => {
  return undefined;
};

// Local noon, not a UTC midnight: recency groups are cut on local days, so a
// fixture a second before midnight UTC is Today here and Yesterday on a runner.
const NOW = new Date(2026, 0, 3, 12).getTime();

const Harness: FC<HarnessProps> = ({
  sessions = [],
  ...overrides
}) => {
  const filters = useSessionFilters(sessions, NOW);
  const selection = useSessionSelection(sessions, filters.visibleSessions, false);

  return (
    <SessionsColumn
      open
      width={320}
      onOpen={noop}
      onClose={noop}
      sessions={sessions}
      sessionsStatus="ready"
      scoped
      scopeName="webapp"
      filters={filters}
      selection={selection}
      selectedFilePath={null}
      projectNames={null}
      nowMs={NOW}
      onSelectSession={noop}
      onOpenMenu={noop}
      onDeleteSessions={noop}
      {...overrides}
    />
  );
};

const render = (props: HarnessProps): void => {
  rtlRender(<ToastProvider><Harness {...props} /></ToastProvider>);
};

describe('SessionsColumn', () => {
  test('lists the sessions, filters them and opens one', async () => {
    const onSelectSession = vi.fn();
    const sessions = [fixtureSession('a', { title: 'Deploy' }), fixtureSession('b', { title: 'Tests' })];

    render({
      sessions,
      onSelectSession,
    });

    await userEvent.type(screen.getByLabelText('Filter sessions'), 'dep');
    expect(screen.queryByText('Tests')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Deploy/ }));

    expect(onSelectSession).toHaveBeenCalledWith(sessions[0]);
  });

  test('enters selection mode, ticks rows and hands the picked ones to delete', async () => {
    const onDeleteSessions = vi.fn();
    const sessions = [fixtureSession('a'), fixtureSession('b')];

    render({
      sessions,
      onDeleteSessions,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Select sessions' }));
    await userEvent.click(screen.getByRole('button', { name: /Session a/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete selected' }));

    expect(onDeleteSessions).toHaveBeenCalledWith([sessions[0]]);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel session selection' }));
    expect(screen.getByRole('button', { name: 'Select sessions' })).toBeDefined();
  });

  test('opens a thread to its parts and folds a recency group away', async () => {
    const sessions = [
      fixtureSession('a', {
        title: 'Thread',
        rootUuid: 'root-1',
        lastTimestampMs: NOW - 1000,
        messageCount: 5,
      }),
      fixtureSession('b', {
        title: 'Thread',
        rootUuid: 'root-1',
        lastTimestampMs: Date.UTC(2026, 0, 1),
        messageCount: 2,
      }),
    ];

    render({ sessions });

    expect(screen.getAllByText('Thread')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: '2 parts' }));
    expect(screen.getAllByText('Thread')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: /Today/ }));
    expect(screen.queryByText('Thread')).toBeNull();
  });

  test('folded, its strip carries every row and unfolds on request', async () => {
    const onOpen = vi.fn();

    render({
      sessions: [fixtureSession('a', { title: 'Deploy' })],
      open: false,
      onOpen,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Show sessions' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeDefined();
  });
});
