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

import { ArchiveView } from './ArchiveView';

import type { AsyncResource } from '@features/history-data';
import type { ArchiveSummary } from '@services/archive/archiveService';

afterEach(() => {
  vi.unstubAllGlobals();
});

const archive: ArchiveSummary = {
  id: '2026-07-01T00-00-00-000Z',
  createdMs: Date.parse('2026-07-01T00:00:00Z'),
  note: 'before the upgrade',
  sessionCount: 2,
  sizeBytes: 4096,
  agents: ['claude'],
};

const noop = (): void => {
  return undefined;
};

const resource = (
  status: AsyncResource<readonly ArchiveSummary[]>['status'],
  data: readonly ArchiveSummary[] | undefined,
  reload = noop,
): AsyncResource<readonly ArchiveSummary[]> => {
  return {
    status,
    data,
    reload,
  };
};

test('totals the archives it was given', () => {
  render(
    <ArchiveView
      archives={resource('ready', [archive, {
        ...archive,
        id: 'second',
        sessionCount: 3,
        sizeBytes: 1024,
      }])}
      onOpenSession={noop}
    />,
  );

  expect(screen.getByText('2')).toBeDefined();
  expect(screen.getByText('5')).toBeDefined();
  expect(screen.getByText('5KB')).toBeDefined();
});

test('invites a first archive when there are none', () => {
  render(<ArchiveView archives={resource('ready', [])} onOpenSession={noop} />);

  expect(screen.getByText('No archives yet')).toBeDefined();
});

test('waits while the list is loading', () => {
  render(<ArchiveView archives={resource('loading', undefined)} onOpenSession={noop} />);

  expect(screen.queryByText('No archives yet')).toBeNull();
});

test('creates an archive with a note and reloads the list', async () => {
  const reload = vi.fn();
  const fetchMock = vi.fn(() => {
    return Response.json({ archive });
  });

  vi.stubGlobal('fetch', fetchMock);
  render(<ArchiveView archives={resource('ready', [])} onOpenSession={noop} />);

  const { rerender } = render(
    <ArchiveView archives={resource('ready', [], reload)} onOpenSession={noop} />,
  );

  await userEvent.type(screen.getAllByLabelText('Archive note')[1] ?? document.body, 'before upgrade');
  await userEvent.click(screen.getAllByText('Create archive')[1] ?? document.body);

  await waitFor(() => {
    expect(reload).toHaveBeenCalledTimes(1);
  });

  rerender(<ArchiveView archives={resource('ready', [archive], reload)} onOpenSession={noop} />);
  expect(screen.getAllByText('before the upgrade').length).toBeGreaterThan(0);
});

test('reports a failed creation', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return new Response('{"error":"disk full"}', { status: 500 });
  }));

  render(<ArchiveView archives={resource('ready', [])} onOpenSession={noop} />);
  await userEvent.click(screen.getByText('Create archive'));

  expect(await screen.findByText('disk full')).toBeDefined();
});

test('confirms before deleting, then reloads', async () => {
  const reload = vi.fn();

  vi.stubGlobal('fetch', vi.fn(() => {
    return Response.json({ ok: true });
  }));
  render(<ArchiveView archives={resource('ready', [archive], reload)} onOpenSession={noop} />);

  await userEvent.click(screen.getByTitle('Delete archive'));
  expect(screen.getByRole('dialog')).toBeDefined();

  await userEvent.click(screen.getAllByText('Delete archive').at(-1) ?? document.body);

  await waitFor(() => {
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

test('leaves the archive alone when the confirmation is dismissed', async () => {
  const reload = vi.fn();

  render(<ArchiveView archives={resource('ready', [archive], reload)} onOpenSession={noop} />);

  await userEvent.click(screen.getByTitle('Delete archive'));
  await userEvent.click(screen.getByText('Cancel'));

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  expect(reload).not.toHaveBeenCalled();
});

test('reports a failed deletion', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return new Response('{"error":"archive locked"}', { status: 500 });
  }));
  render(<ArchiveView archives={resource('ready', [archive])} onOpenSession={noop} />);

  await userEvent.click(screen.getByTitle('Delete archive'));
  await userEvent.click(screen.getAllByText('Delete archive').at(-1) ?? document.body);

  expect(await screen.findByText('archive locked')).toBeDefined();
});
