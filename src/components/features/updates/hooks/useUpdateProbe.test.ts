import {
  act,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { useUpdateProbe } from './useUpdateProbe';

const stub = (body: object): void => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Response.json(body);
  }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test('asks nothing until it is asked', () => {
  vi.stubGlobal('fetch', vi.fn());

  const { result } = renderHook(useUpdateProbe);

  expect(result.current.stage).toBe('idle');
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
});

test('reports a build that is current', async () => {
  stub({ update: { stage: 'none' } });

  const { result } = renderHook(useUpdateProbe);

  act(() => {
    result.current.check();
  });

  await waitFor(() => {
    expect(result.current.stage).toBe('upToDate');
  });
});

test('names the version waiting when there is one', async () => {
  stub({
    update: {
      stage: 'available',
      version: '9.9.9',
    },
  });

  const { result } = renderHook(useUpdateProbe);

  act(() => {
    result.current.check();
  });

  await waitFor(() => {
    expect(result.current.stage).toBe('available');
  });
  expect(result.current.version).toBe('9.9.9');
});

test('says so rather than going quiet when the feed cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.reject(new Error('offline'));
  }));

  const { result } = renderHook(useUpdateProbe);

  act(() => {
    result.current.check();
  });

  await waitFor(() => {
    expect(result.current.stage).toBe('failed');
  });
});

test('says it is checking while the answer is still coming', () => {
  vi.stubGlobal('fetch', vi.fn(() => {
    return new Promise<Response>(() => {
      return undefined;
    });
  }));

  const { result } = renderHook(useUpdateProbe);

  act(() => {
    result.current.check();
  });

  expect(result.current.stage).toBe('checking');
});
