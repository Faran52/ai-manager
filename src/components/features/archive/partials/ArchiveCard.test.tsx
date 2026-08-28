import {
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { ArchiveCard } from './ArchiveCard';

import type { ArchiveSummary } from '@services/archive/archiveService';

afterEach(() => {
  vi.unstubAllGlobals();
});

const archive: ArchiveSummary = {
  id: '2026-07-01T00-00-00-000Z',
  createdMs: Date.parse('2026-07-01T00:00:00Z'),
  note: 'before the upgrade',
  sessionCount: 1,
  sizeBytes: 2048,
  agents: ['claude'],
};

const noop = (): void => {
  return undefined;
};

const stubDetail = (sessions: readonly object[]): void => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Response.json({
      archive: {
        ...archive,
        sessions,
      },
    });
  }));
};

test('names an archive by its note and loads sessions once expanded', async () => {
  stubDetail([{
    agent: 'claude',
    projectId: 'proj',
    projectName: 'webapp',
    actualSessionId: 's',
    title: 'Login fix',
    messageCount: 3,
    lastTimestampMs: 1,
    sizeBytes: 2048,
    sourcePath: '/home/.claude/projects/proj/s.jsonl',
    archivePath: '/archives/a/files/claude/proj/s.jsonl',
  }]);

  const onOpenSession = vi.fn();

  render(<ArchiveCard archive={archive} onOpenSession={onOpenSession} onDelete={noop} />);

  expect(screen.getByText('before the upgrade')).toBeDefined();
  expect(screen.getByText(/1 session/)).toBeDefined();
  expect(screen.queryByText('Login fix')).toBeNull();

  await userEvent.click(screen.getByText('before the upgrade'));

  expect(await screen.findByText('Login fix')).toBeDefined();
  expect(screen.getByText('webapp')).toBeDefined();
  expect(screen.getByText('Claude Code')).toBeDefined();

  await userEvent.click(screen.getByText('Login fix'));
  expect(onOpenSession).toHaveBeenCalledTimes(1);
});

test('does not refetch when it is collapsed and opened again', async () => {
  stubDetail([]);
  render(<ArchiveCard archive={archive} onOpenSession={noop} onDelete={noop} />);

  await userEvent.click(screen.getByText('before the upgrade'));
  expect(await screen.findByText('This archive holds no sessions.')).toBeDefined();

  await userEvent.click(screen.getByText('before the upgrade'));
  await userEvent.click(screen.getByText('before the upgrade'));

  expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
});

test('shows an empty list when the archive has gone missing', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Response.json({ archive: null });
  }));

  render(<ArchiveCard archive={archive} onOpenSession={noop} onDelete={noop} />);
  await userEvent.click(screen.getByText('before the upgrade'));

  expect(await screen.findByText('This archive holds no sessions.')).toBeDefined();
});

test('shows an empty list when the archive cannot be read', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return new Response('{"error":"gone"}', { status: 500 });
  }));

  render(<ArchiveCard archive={archive} onOpenSession={noop} onDelete={noop} />);
  await userEvent.click(screen.getByText('before the upgrade'));

  expect(await screen.findByText('This archive holds no sessions.')).toBeDefined();
});

test('falls back to the created date and reports a delete request', async () => {
  const onDelete = vi.fn();

  render(
    <ArchiveCard
      archive={{
        ...archive,
        note: '',
      }}
      onOpenSession={noop}
      onDelete={onDelete}
    />,
  );

  expect(screen.queryByText('before the upgrade')).toBeNull();

  await userEvent.click(screen.getByTitle('Delete archive'));

  await waitFor(() => {
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
