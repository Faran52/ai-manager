import {
  describe,
  expect,
  test,
} from 'vitest';

import {
  IDLE_CLASS,
  levelClass,
  levelFor,
} from './heatmapLevels';

describe('levelFor', () => {
  test('is idle without tokens or a peak', () => {
    expect(levelFor(0, 100)).toBe(0);
    expect(levelFor(50, 0)).toBe(0);
  });

  test('buckets against quarter and sixty percent of the peak', () => {
    expect(levelFor(24, 100)).toBe(1);
    expect(levelFor(25, 100)).toBe(2);
    expect(levelFor(59, 100)).toBe(2);
    expect(levelFor(60, 100)).toBe(3);
  });
});

describe('levelClass', () => {
  test('maps each level to its wash', () => {
    expect(levelClass(0, 100)).toBe(IDLE_CLASS);
    expect(levelClass(10, 100)).toBe('bg-ok/40');
    expect(levelClass(30, 100)).toBe('bg-ok/70');
    expect(levelClass(90, 100)).toBe('bg-ok');
  });
});
