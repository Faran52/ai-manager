import { renderHook } from '@testing-library/react';
import {
  afterEach,
  expect,
  test,
  vi,
} from 'vitest';

import { useReducedMotion } from './useReducedMotion';

const listeners = new Set<() => void>();

const stubMatchMedia = (matches: boolean): void => {
  vi.stubGlobal('matchMedia', () => {
    return {
      matches,
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener);
      },
    };
  });
};

afterEach(() => {
  listeners.clear();
  vi.unstubAllGlobals();
});

test('reports the reduced-motion preference and tears its listener down', () => {
  stubMatchMedia(true);

  const { result, unmount } = renderHook(() => {
    return useReducedMotion();
  });

  expect(result.current).toBe(true);
  expect(listeners.size).toBe(1);

  unmount();

  expect(listeners.size).toBe(0);
});

test('reports the default when motion is allowed', () => {
  stubMatchMedia(false);

  const { result } = renderHook(() => {
    return useReducedMotion();
  });

  expect(result.current).toBe(false);
});
