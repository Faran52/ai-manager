import { renderHook, waitFor } from '@testing-library/react';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { useGlobalStats } from './useGlobalStats';

afterEach(() => {
  vi.unstubAllGlobals();
});

const respondWith = (body: string, ok = true): void => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response(body, { status: ok ? 200 : 500 }));
  }));
};

test('reads the whole-machine report once', async () => {
  respondWith(JSON.stringify({ stats: { agents: [] } }));

  const { result } = renderHook(useGlobalStats);

  expect(result.current.status).toBe('loading');
  await waitFor(() => {
    expect(result.current.status).toBe('ready');
  });
  expect(result.current.data).toEqual({ agents: [] });
});

test('reports a failed or malformed read as an error', async () => {
  respondWith('{"nope":true}');

  const { result } = renderHook(useGlobalStats);

  await waitFor(() => {
    expect(result.current.status).toBe('error');
  });
});

test('drops a response or a failure that lands after the view has gone', async () => {
  const pending = Promise.withResolvers<Response>();

  vi.stubGlobal('fetch', vi.fn(() => {
    return pending.promise;
  }));

  const { result, unmount } = renderHook(useGlobalStats);

  unmount();
  pending.resolve(new Response(JSON.stringify({ stats: { agents: [] } })));
  await pending.promise;
  expect(result.current.status).toBe('loading');

  const failing = Promise.withResolvers<Response>();

  vi.stubGlobal('fetch', vi.fn(() => {
    return failing.promise;
  }));

  const second = renderHook(useGlobalStats);

  second.unmount();
  failing.reject(new Error('offline'));
  await expect(failing.promise).rejects.toThrow('offline');
  expect(second.result.current.status).toBe('loading');
});
