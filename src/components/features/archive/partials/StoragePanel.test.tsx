import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

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
    entries: [
      {
        name: 'tmp',
        path: '/home/.codex/tmp',
        bytes: 3_500_000,
      },
      {
        name: 'plugins',
        path: '/home/.codex/plugins',
        bytes: 500_000,
      },
    ],
  }],
  totalBytes: 4_000_000,
  partial: false,
};

test('names each agent, its total and what is largest inside', () => {
  render(<StoragePanel storage={resource('ready', report)} />);

  expect(screen.getByText('Codex CLI')).toBeDefined();
  expect(screen.getByText('tmp')).toBeDefined();
  expect(screen.getByText('plugins')).toBeDefined();
  expect(screen.getByText('1')).toBeDefined();
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

test('promises it deletes nothing', () => {
  render(<StoragePanel storage={resource('ready', report)} />);

  expect(screen.getByText(/deleted by this app/)).toBeDefined();
});

test('says so when no agent holds anything', () => {
  render(
    <StoragePanel storage={resource('ready', {
      agents: [],
      totalBytes: 0,
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
