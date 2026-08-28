import type { Transition } from 'motion/react';

// Shared expo-out curve; every surface enters and exits on this single easing.
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const MOTION_DURATION_FAST = 0.16;
export const MOTION_DURATION_BASE = 0.3;

export const fadeTransition: Transition = {
  duration: MOTION_DURATION_FAST,
  ease: 'easeOut',
};

export const riseTransition: Transition = {
  duration: MOTION_DURATION_BASE,
  ease: EASE_OUT_EXPO,
};

export const popoverTransition: Transition = {
  duration: MOTION_DURATION_FAST,
  ease: EASE_OUT_EXPO,
};

export const collapseTransition: Transition = {
  duration: MOTION_DURATION_BASE,
  ease: EASE_OUT_EXPO,
};
