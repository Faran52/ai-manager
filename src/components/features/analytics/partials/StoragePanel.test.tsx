import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { parseJsonContainer } from '@utils/jsonUtils';

import { StoragePanel } from './StoragePanel';

import type { AsyncResource } from '@features/history-data';
import type { StorageReport } from '@services/storage/storageService';

const noop = (): void => {
  return undefined;
};

const resource = (
  status: AsyncResource<StorageReport>['status'],
  data: StorageReport | undefined,
  error?: string,
): AsyncResource<StorageReport> => {
  return {
    status,
    data,
    error,
    reload: noop,
  };
};

const report: StorageReport = {
  agents: [{
    agent: 'codex',
    label: 'Codex CLI',
    bytes: 4_000_000,
    reclaimableBytes: 3_500_000,
    entries: [
      {
        name: 'cache',
        path: '/home/.codex/cache',
        bytes: 3_500_000,
        reclaimable: true,
      },
      {
        name: 'plugins',
        path: '/home/.codex/plugins',
        bytes: 500_000,
        reclaimable: false,
      },
    ],
  }],
  totalBytes: 4_000_000,
  reclaimableBytes: 3_500_000,
  partial: false,
};

test('names each agent, its total and what is largest inside', () => {
  render(<StoragePanel storage={resource('ready', report)} />);

  expect(screen.getByText('Codex CLI')).toBeDefined();
  expect(screen.getByText('cache')).toBeDefined();
  expect(screen.getByText('plugins')).toBeDefined();
  expect(screen.getByText('1')).toBeDefined();
});

test('never puts a list item straight inside another, which breaks hydration', () => {
  const { container } = render(<StoragePanel storage={resource('ready', report)} />);

  const misnested = [...container.querySelectorAll('li')].filter((item) => {
    return item.parentElement?.tagName === 'LI';
  });

  expect(misnested).toHaveLength(0);
});

test('says the total is a floor when the scan was cut short', () => {
  render(
    <StoragePanel storage={resource('ready', {
      ...report,
      partial: true,
    })}
    />,
  );

  expect(screen.getByText(/stopped at its limit/)).toBeDefined();
});

test('says what it will and will not remove', () => {
  render(<StoragePanel storage={resource('ready', report)} />);

  expect(screen.getByText(/Transcripts, archives and generated files are never touched/))
    .toBeDefined();
});

test('says so when no agent holds anything', () => {
  render(
    <StoragePanel storage={resource('ready', {
      agents: [],
      totalBytes: 0,
      reclaimableBytes: 0,
      partial: false,
    })}
    />,
  );

  expect(screen.getByText('No agent storage found')).toBeDefined();
});

test('waits while measuring and reports a failure', () => {
  const { unmount } = render(<StoragePanel storage={resource('loading', undefined)} />);

  expect(screen.queryByText('Codex CLI')).toBeNull();
  unmount();

  render(<StoragePanel storage={resource('error', undefined, 'denied')} />);
  expect(screen.getByText('denied')).toBeDefined();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('offers to free only what the agents can rebuild, once confirmed', async () => {
  let asked: string | undefined;
  const reloads: number[] = [];

  vi.stubGlobal('fetch', vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
    asked = typeof init?.body === 'string' ? init.body : undefined;

    return Promise.resolve(Response.json({
      result: {
        removed: ['/home/.codex/cache'],
        freedBytes: 3_500_000,
        refused: [],
      },
    }));
  }));

  render(
    <StoragePanel storage={{
      status: 'ready',
      data: report,
      reload: () => {
        reloads.push(1);
      },
    }}
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Free it up' }));

  expect(screen.getByText('/home/.codex/cache')).toBeDefined();
  expect(screen.queryByText('/home/.codex/plugins')).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'Delete them' }));

  expect(parseJsonContainer(asked ?? '{}')).toEqual({ paths: ['/home/.codex/cache'] });
  expect(await screen.findByText('Removed 1 item, freeing 3MB.')).toBeDefined();
  expect(reloads).toHaveLength(1);
});

test('deletes nothing when the offer is dismissed', async () => {
  const fetchMock = vi.fn();

  vi.stubGlobal('fetch', fetchMock);
  render(<StoragePanel storage={resource('ready', report)} />);

  await userEvent.click(screen.getByRole('button', { name: 'Free it up' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(fetchMock).not.toHaveBeenCalled();
  expect(document.querySelector('[data-reclaim-notice]')).toBeNull();
});

test('says nothing was deleted when the removal failed', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.reject(new Error('denied'));
  }));

  render(<StoragePanel storage={resource('ready', report)} />);

  await userEvent.click(screen.getByRole('button', { name: 'Free it up' }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete them' }));

  expect(await screen.findByText('Nothing was deleted: the files could not be removed.'))
    .toBeDefined();
});

test('offers nothing to free when everything held is worth keeping', () => {
  render(
    <StoragePanel storage={resource('ready', {
      ...report,
      reclaimableBytes: 0,
      agents: [{
        ...report.agents[0] ?? {
          agent: 'codex',
          label: 'Codex CLI',
          bytes: 0,
          reclaimableBytes: 0,
          entries: [],
        },
        reclaimableBytes: 0,
        entries: (report.agents[0]?.entries ?? []).filter((entry) => {
          return !entry.reclaimable;
        }),
      }],
    })}
    />,
  );

  expect(screen.queryByRole('button', { name: 'Free it up' })).toBeNull();
});

test('narrows every figure to one agent when one is named', () => {
  render(<StoragePanel storage={resource('ready', report)} agent="claude" />);

  expect(screen.queryByText('Codex CLI')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Free it up' })).toBeNull();
  expect(screen.getByText('No agent storage found')).toBeDefined();
});
