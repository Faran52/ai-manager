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

import { appMenuEvent } from '@config/appCommands';

import { useNativeMenu } from './useNativeMenu';

const noop = (): void => {
  return undefined;
};

const stubBindings = (platform: string): ReturnType<typeof vi.fn> => {
  const setApplicationMenu = vi.fn(() => {
    return Promise.resolve(undefined);
  });

  Object.defineProperty(window, 'bindings', {
    configurable: true,
    value: {
      desktopPlatform: () => {
        return Promise.resolve(platform);
      },
      setApplicationMenu,
    },
  });

  return setApplicationMenu;
};

afterEach(() => {
  Reflect.deleteProperty(window, 'bindings');
});

test('leaves a browser alone, where there is no window to hand a menu to', () => {
  const { result } = renderHook(() => {
    return useNativeMenu(noop);
  });

  expect(result.current).toBe(false);
});

test('hands the menu over on a platform that draws a global bar', async () => {
  const setApplicationMenu = stubBindings('darwin');

  const { result } = renderHook(() => {
    return useNativeMenu(noop);
  });

  await waitFor(() => {
    expect(result.current).toBe(true);
  });
  expect(setApplicationMenu).toHaveBeenCalledTimes(1);
});

test('leaves Windows its own titlebar controls', async () => {
  const setApplicationMenu = stubBindings('windows');

  const { result } = renderHook(() => {
    return useNativeMenu(noop);
  });

  await waitFor(() => {
    expect(setApplicationMenu).not.toHaveBeenCalled();
  });
  expect(result.current).toBe(false);
});

test('runs a command the window reports, and ignores one it does not know', () => {
  const run = vi.fn();

  renderHook(() => {
    return useNativeMenu(run);
  });

  act(() => {
    window.dispatchEvent(new CustomEvent(appMenuEvent, { detail: 'settings' }));
    window.dispatchEvent(new CustomEvent(appMenuEvent, { detail: 'nonsense' }));
  });

  expect(run.mock.calls).toEqual([['settings']]);
});

test('does not report a menu it handed over after the caller had gone', async () => {
  const setApplicationMenu = stubBindings('darwin');

  const { result, unmount } = renderHook(() => {
    return useNativeMenu(noop);
  });

  unmount();
  await waitFor(() => {
    expect(setApplicationMenu).toHaveBeenCalled();
  });

  expect(result.current).toBe(false);
});
