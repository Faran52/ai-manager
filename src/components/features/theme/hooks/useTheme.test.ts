import { act, renderHook } from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { useTheme } from './useTheme';

interface MediaChangeEvent {
  readonly matches: boolean;
}

type MediaChangeListener = (event: MediaChangeEvent) => void;

const mediaListeners = new Set<MediaChangeListener>();

afterEach(() => {
  mediaListeners.clear();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const stubMatchMedia = (initial: boolean): void => {
  const list = {
    matches: initial,
    addEventListener: (_: string, listener: MediaChangeListener) => {
      mediaListeners.add(listener);
    },
    removeEventListener: (_: string, listener: MediaChangeListener) => {
      mediaListeners.delete(listener);
    },
  };

  vi.stubGlobal('matchMedia', vi.fn(() => {
    return list;
  }));
};

describe('useTheme', () => {
  test('defaults to system and resolves dark from the OS preference', () => {
    stubMatchMedia(true);

    const { result } = renderHook(() => {
      return useTheme();
    });

    expect(result.current.mode).toBe('system');
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  test('persists an explicit mode and reflects it on the document', () => {
    stubMatchMedia(false);

    const { result } = renderHook(() => {
      return useTheme();
    });

    act(() => {
      result.current.setMode('dark');
    });

    expect(localStorage.getItem('acm-theme')).toBe('dark');
    expect(result.current.isDark).toBe(true);
  });

  test('tracks live OS changes while in system mode only', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => {
      return useTheme();
    });

    for (const listener of mediaListeners) {
      listener({ matches: true });
    }

    expect(result.current.isDark).toBe(false);

    act(() => {
      result.current.setMode('light');
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('useTheme stored modes', () => {
  test('honours a persisted light mode over the OS preference', () => {
    stubMatchMedia(true);
    localStorage.setItem('acm-theme', 'light');

    const { result } = renderHook(() => {
      return useTheme();
    });

    expect(result.current.mode).toBe('light');
    expect(result.current.isDark).toBe(false);
  });

  test('stops listening once an explicit mode is chosen', () => {
    stubMatchMedia(true);
    const { result, unmount } = renderHook(() => {
      return useTheme();
    });

    act(() => {
      result.current.setMode('dark');
    });
    unmount();

    for (const listener of mediaListeners) {
      listener({ matches: false });
    }

    expect(localStorage.getItem('acm-theme')).toBe('dark');
  });
});
