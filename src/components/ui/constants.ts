import type { Transition } from 'motion/react';

// Shared expo-out curve; every surface enters and exits on this single easing.
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const MOTION_DURATION_FAST = 0.16;
export const MOTION_DURATION_BASE = 0.3;
export const MOTION_DURATION_SLOW = 0.7;

/*
 * Expo-out covers most of its distance in the first tenth of the tween, which
 * suits a surface arriving but makes a bar look like it was always full. A
 * figure growing to its value wants the slower curve and the longer duration.
 */
export const EASE_OUT_CUBIC: [number, number, number, number] = [0.33, 1, 0.68, 1];

// Marks in one list fill in sequence, so the eye reads an order rather than a flash.
export const MOTION_STAGGER = 0.05;

// Wheel easing. The factor is the share of the remaining distance covered in a
// 60Hz frame, and the epsilon is where a glide is close enough to call landed.
export const SMOOTH_FACTOR = 0.085;
export const SMOOTH_EPSILON = 0.35;
export const BASELINE_FRAME_MS = 1000 / 60;
export const MAX_FRAME_MS = 100;
export const SYNC_TOLERANCE = 2;
export const WHEEL_LINE_PX = 16;
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

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

export const fillTransition: Transition = {
  duration: MOTION_DURATION_SLOW,
  ease: EASE_OUT_CUBIC,
};
