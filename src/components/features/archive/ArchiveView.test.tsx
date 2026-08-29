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
import type { RetentionStatusResponse } from '@lib/apis/contracts';
import type { ArchiveSummary } from '@services/archive/archiveService';
import type { PromptHistory } from '@services/prompts/promptsService';
import type { StorageReport } from '@services/storage/storageService';

afterEach(() => {
  vi.unstubAllGlobals();
});

const NOW = Date.parse('2026-08-28T12:00:00Z');

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

const retentionResource: AsyncResource<RetentionStatusResponse> = {
  status: 'ready',
  data: {
    policy: {
      enabled: false,
      olderThanDays: 30,
      agents: [],
    },
    due: { sessions: [] },
  },
  reload: noop,
};

const storageResource: AsyncResource<StorageReport> = {
  status: 'ready',
  data: {
    agents: [],
    totalBytes: 0,
    reclaimableBytes: 0,
    partial: false,
  },
  reload: noop,
};

const promptResource: AsyncResource<PromptHistory> = {
  status: 'ready',
  data: {
    prompts: [],
    projects: [],
    total: 0,
  },
  reload: noop,
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
      prompts={promptResource}
      retention={retentionResource}
      storage={storageResource}
      nowMs={NOW}
      onOpenPrompt={noop}
    />,
  );

  expect(screen.getByText('2')).toBeDefined();
  expect(screen.getByText('5')).toBeDefined();
  expect(screen.getByText('5KB')).toBeDefined();
});

test('invites a first archive when there are none', () => {
  render(
    <ArchiveView
      archives={resource('ready', [])}
      onOpenSession={noop}
      prompts={promptResource}
      retention={retentionResource}
      storage={storageResource}
      nowMs={NOW}
      onOpenPrompt={noop}
    />,
  );

  expect(screen.getByText('No archives yet')).toBeDefined();
});

test('waits while the list is loading', () => {
  render(
    <ArchiveView
      archives={resource('loading', undefined)}
      onOpenSession={noop}
      prompts={promptResource}
      retention={retentionResource}
      storage={storageResource}
      nowMs={NOW}
      onOpenPrompt={noop}
    />,
  );

  expect(screen.queryByText('No archives yet')).toBeNull();
});

test('creates an archive with a note and reloads the list', async () => {
  const reload = vi.fn();
  const fetchMock = vi.fn(() => {
    return Response.json({ archive });
  });

  vi.stubGlobal('fetch', fetchMock);
  render(
    <ArchiveView
      archives={resource('ready', [])}
      onOpenSession={noop}
      prompts={promptResource}
      retention={retentionResource}
      storage={storageResource}
      nowMs={NOW}
      onOpenPrompt={noop}
    />,
  );

  const { rerender } = render(
    <ArchiveView
      archives={resource('ready', [], reload)}
      onOpenSession={noop}
      prompts={promptResource}
      retention={retentionResource}
      storage={storageResource}
      nowMs={NOW}
      onOpenPrompt={noop}
    />,
  );

  await userEvent.type(screen.getAllByLabelText('Archive note')[1] ?? document.body, 'before upgrade');
  await userEvent.click(screen.getAllByText('Create archive')[1] ?? document.body);

  await waitFor(() => {
    expect(reload).toHaveBeenCalledTimes(1);
  });

  rerender(
    <ArchiveView
      archives={resource('ready', [archive], reload)}
      onOpenSession={noop}
      prompts={promptResource}
      retention={retentionResource}
      storage={storageResource}
      nowMs={NOW}
      onOpenPrompt={noop}
    />,
  );
  expect(screen.getAllByText('before the upgrade').length).toBeGreaterThan(0);
});

test('reports a failed creation', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return new Response('{"error":"disk full"}', { status: 500 });
  }));

  render(
    <ArchiveView
      archives={resource('ready', [])}
      onOpenSession={noop}
      prompts={promptResource}
      retention={retentionResource}
      storage={storageResource}
      nowMs={NOW}
      onOpenPrompt={noop}
    />,
  );
  await userEvent.click(screen.getByText('Create archive'));

  expect(await screen.findByText('disk full')).toBeDefined();
});

test('confirms before deleting, then reloads', async () => {
  const reload = vi.fn();

  vi.stubGlobal('fetch', vi.fn(() => {
    return Response.json({ ok: true });
  }));
  render(
    <ArchiveView
      archives={resource('ready', [archive], reload)}
      onOpenSession={noop}
      prompts={promptResource}
      retention={retentionResource}
      storage={storageResource}
      nowMs={NOW}
      onOpenPrompt={noop}
    />,
  );

  await userEvent.click(screen.getByTitle('Delete archive'));
  expect(screen.getByRole('dialog')).toBeDefined();

  await userEvent.click(screen.getAllByText('Delete archive').at(-1) ?? document.body);

  await waitFor(() => {
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

test('leaves the archive alone when the confirmation is dismissed', async () => {
  const reload = vi.fn();

  render(
    <ArchiveView
      archives={resource('ready', [archive], reload)}
      onOpenSession={noop}
      prompts={promptResource}
      retention={retentionResource}
      storage={storageResource}
      nowMs={NOW}
      onOpenPrompt={noop}
    />,
  );

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
  render(
    <ArchiveView
      archives={resource('ready', [archive])}
      onOpenSession={noop}
      prompts={promptResource}
      retention={retentionResource}
      storage={storageResource}
      nowMs={NOW}
      onOpenPrompt={noop}
    />,
  );

  await userEvent.click(screen.getByTitle('Delete archive'));
  await userEvent.click(screen.getAllByText('Delete archive').at(-1) ?? document.body);

  expect(await screen.findByText('archive locked')).toBeDefined();
});

test('switches to the storage panel', async () => {
  render(
    <ArchiveView
      archives={resource('ready', [archive])}
      prompts={promptResource}
      retention={retentionResource}
      storage={{
        status: 'ready',
        data: {
          agents: [],
          totalBytes: 2_048,
          reclaimableBytes: 0,
          partial: false,
        },
        reload: noop,
      }}
      nowMs={NOW}
      onOpenSession={noop}
      onOpenPrompt={noop}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Storage' }));

  expect(screen.getByText('2KB')).toBeDefined();
  expect(screen.queryByText('before the upgrade')).toBeNull();
});

test('switches to the prompt history panel', async () => {
  render(
    <ArchiveView
      archives={resource('ready', [archive])}
      prompts={{
        status: 'ready',
        data: {
          prompts: [],
          projects: [],
          total: 12,
        },
        reload: noop,
      }}
      retention={retentionResource}
      storage={storageResource}
      nowMs={NOW}
      onOpenSession={noop}
      onOpenPrompt={noop}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Prompt history' }));

  expect(screen.getByText('12')).toBeDefined();
  expect(screen.queryByText('before the upgrade')).toBeNull();
});
