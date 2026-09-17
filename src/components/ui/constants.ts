import type { TargetAndTransition, Transition } from 'motion/react';

export interface ArrivalProps {
  readonly initial: TargetAndTransition;
  readonly animate: TargetAndTransition;
  readonly transition: Transition;
}

/*
 * Springs, not eased durations, for anything interruptible: a tween restarts
 * from its curve mid-flight. visualDuration is how it looks, bounce is overshoot.
 */
export const MOTION_DURATION_FAST = 0.16;
export const MOTION_DURATION_BASE = 0.3;
export const MOTION_DURATION_SLOW = 0.7;

// Marks in one list fill in sequence, so the eye reads an order rather than a flash.
export const MOTION_STAGGER = 0.05;

// Capped so a long list never keeps its tail waiting on the rows above it.
export const staggerDelay = (index: number): number => {
  return Math.min(index, 12) * MOTION_STAGGER;
};

// The app root MotionConfig reducedMotion="user" strips the travel, so callers
// need no check of their own.
export const arriveInSequence = (index: number): ArrivalProps => {
  return {
    initial: {
      opacity: 0,
      y: 4,
    },
    animate: {
      opacity: 1,
      y: 0,
    },
    transition: {
      ...fadeTransition,
      delay: staggerDelay(index),
    },
  };
};

// Opacity alone has no distance to travel, so a spring would have nothing to
// model. A short linear-ish fade is both cheaper and steadier.
export const fadeTransition: Transition = {
  duration: MOTION_DURATION_FAST,
  ease: 'easeOut',
};

// A surface arriving: dialogs, sheets, panes. Enough bounce to feel physical,
// not enough to wobble.
export const riseTransition: Transition = {
  type: 'spring',
  visualDuration: 0.32,
  bounce: 0.14,
};

// A popover is small and near its trigger, so it settles faster and flatter.
export const popoverTransition: Transition = {
  type: 'spring',
  visualDuration: 0.2,
  bounce: 0.04,
};

// A tween, not a spring: over hundreds of pixels a spring tail runs for a
// second before it is inside the rest tolerance, and a disclosure wants a hard end.
export const collapseTransition: Transition = {
  duration: 0.24,
  ease: 'easeOut',
};

/*
 * The one exception to not animating width: the bounded carve-out a height
 * disclosure gets. Spring for an interrupting click, zero bounce so nothing overshoots.
 */
export const foldTransition: Transition = {
  type: 'spring',
  visualDuration: 0.34,
  bounce: 0,
};

/*
 * A control answering a direct gesture: a switch thumb, a tab marker. Fastest of
 * the set, because the reader's own finger or key is the cause.
 */
export const controlTransition: Transition = {
  type: 'spring',
  visualDuration: 0.18,
  bounce: 0.2,
};

/*
 * A surface being revealed rather than a column snapping to its marks, so it
 * takes longer and eases harder into place. Zero bounce, same as a fold.
 */
export const drawerTransition: Transition = {
  type: 'spring',
  visualDuration: 0.44,
  bounce: 0,
};

// The one place a spring is forbidden rather than unhelpful: a bar that
// overshoots shows a number the data does not support and then corrects.
export const fillTransition: Transition = {
  duration: MOTION_DURATION_SLOW,
  ease: [0.33, 1, 0.68, 1],
};

// Wheel easing. The factor is the share of the remaining distance covered in a
// 60Hz frame, and the epsilon is where a glide is close enough to call landed.
export const SMOOTH_FACTOR = 0.085;
export const SMOOTH_EPSILON = 0.35;
export const BASELINE_FRAME_MS = 1000 / 60;
export const MAX_FRAME_MS = 100;
export const SYNC_TOLERANCE = 2;
export const WHEEL_LINE_PX = 16;
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Under testing-library's 1000ms default timeout, or every wait behind a
// loader becomes a race.
export const LOADER_MIN_MS = 400;

/**
 * How close to the end of a scrolling box counts as being at it, how far a
 * press may travel before it is a drag, how wide the docked button is, and how
 * long to hold the end while content finishes measuring.
 */
export const SCROLL_END_MARGIN_PX = 64;
export const DRAG_SLOP_PX = 4;
export const DOCK_SIZE_PX = 56;
export const SETTLE_MS = 1_000;
