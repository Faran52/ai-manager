import { renderHook } from '@testing-library/react';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { useLastPresent } from './useLastPresent';

describe('useLastPresent', () => {
  it('is undefined until a value arrives', () => {
    const { result } = renderHook(() => {
      return useLastPresent<string>(null);
    });

    expect(result.current).toBeUndefined();
  });

  it('returns the present value and keeps it once it clears', () => {
    const { result, rerender } = renderHook<string | undefined, { value: string | null }>(
      ({ value }) => {
        return useLastPresent(value);
      },
      { initialProps: { value: 'first' } },
    );

    expect(result.current).toBe('first');

    rerender({ value: null });
    expect(result.current).toBe('first');
  });

  it('replaces the retained value when a new one arrives', () => {
    const { result, rerender } = renderHook<string | undefined, { value: string | null }>(
      ({ value }) => {
        return useLastPresent(value);
      },
      { initialProps: { value: 'first' } },
    );

    rerender({ value: 'second' });
    expect(result.current).toBe('second');

    rerender({ value: null });
    expect(result.current).toBe('second');
  });

  it('holds steady when the same value repeats', () => {
    const { result, rerender } = renderHook<string | undefined, { value: string | null }>(
      ({ value }) => {
        return useLastPresent(value);
      },
      { initialProps: { value: 'same' } },
    );

    rerender({ value: 'same' });
    expect(result.current).toBe('same');
  });
});
