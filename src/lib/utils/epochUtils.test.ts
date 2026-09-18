import {
  describe,
  expect,
  test,
} from 'vitest';

import { epochMillis } from './epochUtils';

describe('epochMillis', () => {
  const iso = (value: number): string | undefined => {
    const millis = epochMillis(value);

    return millis == null ? undefined : new Date(millis).toISOString();
  };

  test('reads the same instant from seconds, milliseconds, microseconds and nanoseconds', () => {
    expect(iso(1_767_225_600)).toBe('2026-01-01T00:00:00.000Z');
    expect(iso(1_767_225_600_000)).toBe('2026-01-01T00:00:00.000Z');
    expect(iso(1_767_225_600_000_000)).toBe('2026-01-01T00:00:00.000Z');
    expect(iso(1_767_225_600_000_000_000)).toBe('2026-01-01T00:00:00.000Z');
  });

  test('refuses a number too small to be a date', () => {
    expect(epochMillis(7)).toBeUndefined();
    expect(epochMillis(0)).toBeUndefined();
    expect(epochMillis(-1)).toBeUndefined();
  });

  test('refuses a value Date cannot represent', () => {
    expect(epochMillis(Number.NaN)).toBeUndefined();
    expect(epochMillis(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(epochMillis(Number.MAX_VALUE)).toBeUndefined();
  });
});
