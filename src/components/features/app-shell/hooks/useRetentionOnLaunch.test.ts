import { renderHook, screen } from '@testing-library/react';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { toastWrapper } from '@mocks/toastHostFixtures';

import { useRetentionOnLaunch } from './useRetentionOnLaunch';

import type { RunRetentionResponse } from '@lib/apis/contracts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const respondWith = (body: RunRetentionResponse
  | { readonly error: string }, ok = true): void => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response(JSON.stringify(body), {
      status: ok ? 200 : 500,
      headers: { 'content-type': 'application/json' },
    }));
  }));
};

test('reports how many sessions retention archived at launch', async () => {
  respondWith({
    result: {
      archived: 2,
      archiveId: 'a1',
    },
  });
  renderHook(useRetentionOnLaunch, { wrapper: toastWrapper });

  expect(await screen.findByText(/2 sessions/u)).toBeDefined();
});

test('stays quiet when nothing was archived or the run failed', async () => {
  respondWith({
    result: {
      archived: 0,
      archiveId: undefined,
    },
  });
  const { unmount } = renderHook(useRetentionOnLaunch, { wrapper: toastWrapper });

  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(screen.queryByText(/Retention archived/u)).toBeNull();
  unmount();

  respondWith({ error: 'boom' }, false);
  renderHook(useRetentionOnLaunch, { wrapper: toastWrapper });
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(screen.queryByText(/Retention archived/u)).toBeNull();
});
