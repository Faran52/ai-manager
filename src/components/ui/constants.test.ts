import { expect, test } from 'vitest';

import {
  arriveInSequence,
  MOTION_STAGGER,
  staggerDelay,
} from './constants';

test('each sibling arrives a beat after the last, capped for long lists', () => {
  expect(staggerDelay(0)).toBe(0);
  expect(staggerDelay(3)).toBeCloseTo(3 * MOTION_STAGGER);
  expect(staggerDelay(40)).toBeCloseTo(12 * MOTION_STAGGER);
  expect(arriveInSequence(2).transition.delay).toBeCloseTo(2 * MOTION_STAGGER);
});
