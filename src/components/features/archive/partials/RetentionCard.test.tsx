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

import { RetentionCard } from './RetentionCard';

import type { AsyncResource } from '@features/history-data';
import type { RetentionStatusResponse } from '@lib/apis/contracts';
import type { SessionSummary } from '@services/history/historyService';

const NOW = Date.parse('2026-08-29T12:00:00Z');

const noop = (): void => {
  return undefined;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const session = (id: string, title?: string): SessionSummary => {
  return {
    agent: 'claude',
    actualSessionId: id,
    id,
    filePath: `/sessions/${id}.jsonl`,
    projectId: 'p',
    title,
    messageCount: 3,
    firstTimestampMs: NOW - 90 * 24 * 3_600_000,
    lastTimestampMs: NOW - 90 * 24 * 3_600_000,
    modifiedMs: NOW,
    sizeBytes: 10,
  };
};

const status = (
  overrides: Partial<RetentionStatusResponse['policy']> = {},
  sessions: readonly SessionSummary[] = [],
): RetentionStatusResponse => {
  return {
    policy: {
      enabled: false,
      olderThanDays: 30,
      agents: [],
      ...overrides,
    },
    due: { sessions },
  };
};

const resource = (
  state: AsyncResource<RetentionStatusResponse>['status'],
  data: RetentionStatusResponse | undefined,
  reload = noop,
  error?: string,
): AsyncResource<RetentionStatusResponse> => {
  return {
    status: state,
    data,
    error,
    reload,
  };
};

const renderCard = (
  value: AsyncResource<RetentionStatusResponse> = resource('ready', status()),
): void => {
  render(<RetentionCard retention={value} nowMs={NOW} />);
};

test('says the rule only ever copies', () => {
  renderCard();

  expect(screen.getByText(/never deletes/)).toBeDefined();
});

test('waits while the policy loads and reports a failure to read it', () => {
  const { unmount } = render(
    <RetentionCard retention={resource('loading', undefined)} nowMs={NOW} />,
  );

  expect(screen.queryByText('Retention')).toBeNull();
  unmount();

  renderCard(resource('error', undefined, noop, 'policy unreadable'));
  expect(screen.getByText('policy unreadable')).toBeDefined();
});

test('turns the rule on and reloads', async () => {
  const reload = vi.fn();
  const fetchMock = vi.fn(() => {
    return Response.json(status({ enabled: true }));
  });

  vi.stubGlobal('fetch', fetchMock);
  renderCard(resource('ready', status(), reload));

  await userEvent.click(screen.getByRole('button', { name: 'Off' }));

  await waitFor(() => {
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

test('shows the rule as on and can turn it back off', async () => {
  const reload = vi.fn();

  vi.stubGlobal('fetch', vi.fn(() => {
    return Response.json(status());
  }));
  renderCard(resource('ready', status({ enabled: true }), reload));

  await userEvent.click(screen.getByRole('button', { name: 'On' }));

  await waitFor(() => {
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

test('refuses an age that is not a whole number of days', async () => {
  renderCard();

  const field = screen.getByLabelText('Retention age in days');

  await userEvent.clear(field);
  await userEvent.type(field, '0');

  expect(screen.getByText(/whole number of days/)).toBeDefined();
  expect(screen.getByRole('button', { name: 'Save' }).closest('button')?.disabled).toBe(true);
});

test('saves a changed age and leaves save disabled when it has not changed', async () => {
  const reload = vi.fn();

  vi.stubGlobal('fetch', vi.fn(() => {
    return Response.json(status({ olderThanDays: 60 }));
  }));
  renderCard(resource('ready', status(), reload));

  expect(screen.getByRole('button', { name: 'Save' }).closest('button')?.disabled).toBe(true);

  const field = screen.getByLabelText('Retention age in days');

  await userEvent.clear(field);
  await userEvent.type(field, '60');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => {
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

test('counts what is due and previews it before anything is archived', async () => {
  renderCard(resource('ready', status({}, [session('a', 'Login fix'), session('b')])));

  expect(screen.getByText('2 sessions due')).toBeDefined();
  expect(screen.queryByText('Login fix')).toBeNull();

  await userEvent.click(screen.getByRole('button', { name: 'Show what would be archived' }));
  expect(screen.getByText('Login fix')).toBeDefined();

  await userEvent.click(screen.getByRole('button', { name: 'Hide the list' }));
  expect(screen.queryByText('Login fix')).toBeNull();
});

test('caps the preview and says how many more there are', async () => {
  const many = Array.from({ length: 11 }, (_, index) => {
    return session(`s${String(index)}`, `Session ${String(index)}`);
  });

  renderCard(resource('ready', status({}, many)));
  await userEvent.click(screen.getByRole('button', { name: 'Show what would be archived' }));

  expect(screen.getByText('and 3 more')).toBeDefined();
});

test('offers nothing to archive when nothing is due', () => {
  renderCard();

  expect(screen.getByText('0 sessions due')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Archive now' }).closest('button')?.disabled).toBe(true);
  expect(screen.queryByRole('button', { name: 'Show what would be archived' })).toBeNull();
});

test('archives on request and reloads', async () => {
  const reload = vi.fn();

  vi.stubGlobal('fetch', vi.fn(() => {
    return Response.json({
      result: {
        archived: 1,
        archiveId: 'a1',
      },
    });
  }));
  renderCard(resource('ready', status({}, [session('a')]), reload));

  await userEvent.click(screen.getByRole('button', { name: 'Archive now' }));

  await waitFor(() => {
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

test('reports a failure to save and a failure to archive', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return new Response('{"error":"read-only"}', { status: 500 });
  }));

  const { unmount } = render(
    <RetentionCard retention={resource('ready', status())} nowMs={NOW} />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'Off' }));
  expect(await screen.findByText('read-only')).toBeDefined();
  unmount();

  renderCard(resource('ready', status({}, [session('a')])));
  await userEvent.click(screen.getByRole('button', { name: 'Archive now' }));
  expect(await screen.findByText('read-only')).toBeDefined();
});
