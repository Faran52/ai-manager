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

const stubUpdater = (checkForUpdate: () => Promise<DesktopUpdate>): void => {
  Object.defineProperty(window, 'bindings', {
    configurable: true,
    value: {
      desktopPlatform: () => {
        return Promise.resolve('darwin');
      },
      setApplicationMenu: () => {
        return Promise.resolve(undefined);
      },
      checkForUpdate,
    },
  });
};

afterEach(() => {
  Reflect.deleteProperty(window, 'bindings');
});

test('asks nothing until it is asked', () => {
  const checkForUpdate = vi.fn(() => {
    return Promise.resolve({ available: false });
  });

  stubUpdater(checkForUpdate);

  const { result } = renderHook(useUpdateProbe);

  expect(result.current.stage).toBe('idle');
  expect(checkForUpdate).not.toHaveBeenCalled();
});

test('reports a build that is current', async () => {
  stubUpdater(() => {
    return Promise.resolve({ available: false });
  });

  const { result } = renderHook(useUpdateProbe);

  act(() => {
    result.current.check();
  });

  await waitFor(() => {
    expect(result.current.stage).toBe('upToDate');
  });
});

test('names the version waiting when there is one', async () => {
  stubUpdater(() => {
    return Promise.resolve({
      available: true,
      version: '9.9.9',
    });
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

test('says so rather than going quiet when the updater throws', async () => {
  stubUpdater(() => {
    return Promise.reject(new Error('offline'));
  });

  const { result } = renderHook(useUpdateProbe);

  act(() => {
    result.current.check();
  });

  await waitFor(() => {
    expect(result.current.stage).toBe('failed');
  });
});

test('says it is checking while the answer is still coming', () => {
  stubUpdater(() => {
    return new Promise<DesktopUpdate>(() => {
      return undefined;
    });
  });

  const { result } = renderHook(useUpdateProbe);

  act(() => {
    result.current.check();
  });

  expect(result.current.stage).toBe('checking');
});

test('has nothing to ask in a browser', () => {
  const { result } = renderHook(useUpdateProbe);

  act(() => {
    result.current.check();
  });

  expect(result.current.stage).toBe('failed');
});
