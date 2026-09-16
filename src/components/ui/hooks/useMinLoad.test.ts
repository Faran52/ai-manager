import { act, renderHook } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  expect,
  test,
  vi,
} from 'vitest';

import { LOADER_MIN_MS } from '../constants';

import { useMinLoad } from './useMinLoad';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('holds the wait on screen for the minimum beat', () => {
  const { result, rerender } = renderHook(
    (loading: boolean) => {
      return useMinLoad(loading);
    },
    { initialProps: true },
  );

  expect(result.current).toBe(true);

  // The read landed, but the loader has not been seen yet.
  rerender(false);
  expect(result.current).toBe(true);

  act(() => {
    vi.advanceTimersByTime(LOADER_MIN_MS);
  });

  expect(result.current).toBe(false);
});

test('holds a fast read for the beat the loader missed', () => {
  const { result, rerender } = renderHook(
    (loading: boolean) => {
      return useMinLoad(loading);
    },
    { initialProps: true },
  );

  rerender(false);
  act(() => {
    vi.advanceTimersByTime(LOADER_MIN_MS / 2);
  });
  expect(result.current).toBe(true);

  act(() => {
    vi.advanceTimersByTime(LOADER_MIN_MS / 2);
  });
  expect(result.current).toBe(false);
});

test('never holds a wait that was never shown', () => {
  const { result, rerender } = renderHook(
    (loading: boolean) => {
      return useMinLoad(loading);
    },
    { initialProps: false },
  );

  expect(result.current).toBe(false);

  rerender(true);
  rerender(false);

  act(() => {
    vi.advanceTimersByTime(LOADER_MIN_MS);
  });

  expect(result.current).toBe(false);
});
