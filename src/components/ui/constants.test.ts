import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  collapseTransition,
  EASE_OUT_EXPO,
  fadeTransition,
  MOTION_DURATION_BASE,
  MOTION_DURATION_FAST,
  popoverTransition,
  riseTransition,
} from './constants';

describe('motionTokens', () => {
  it('exposes the shared expo-out curve and duration scale', () => {
    expect(EASE_OUT_EXPO).toEqual([0.16, 1, 0.3, 1]);
    expect(MOTION_DURATION_FAST).toBeLessThan(MOTION_DURATION_BASE);
  });

  it('rides fast fade for opacity-only surfaces', () => {
    expect(fadeTransition.duration).toBe(MOTION_DURATION_FAST);
    expect(popoverTransition.ease).toEqual(EASE_OUT_EXPO);
  });

  it('uses the base duration for rise and collapse motion', () => {
    expect(riseTransition.duration).toBe(MOTION_DURATION_BASE);
    expect(collapseTransition.duration).toBe(MOTION_DURATION_BASE);
    expect(riseTransition.ease).toEqual(EASE_OUT_EXPO);
  });
});
