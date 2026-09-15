import type { TargetAndTransition, Transition } from 'motion/react';

export interface ArrivalProps {
  readonly initial: TargetAndTransition;
  readonly animate: TargetAndTransition;
  readonly transition: Transition;
}

/*
 * Springs, not eased durations, for anything the reader can interrupt. A tween
 * restarts from its curve when a second gesture arrives mid-flight, which is
 * the stutter that made the old easing read as cheap. A spring carries its
 * velocity across the interruption, which is what makes a macOS surface feel
 * continuous rather than replayed.
 *
 * visualDuration is how long the movement looks like it takes, not how long the
 * spring runs, and bounce is overshoot from 0 to 1. Both describe what a reader
 * sees, unlike stiffness and damping.
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

/*
 * A list item, card or section arriving: a short fade with a few pixels of
 * settle, each sibling a beat after the last. Spread onto a motion element.
 * The app root's MotionConfig reducedMotion="user" strips the travel for a
 * reduced-motion reader, so callers need no check of their own.
 */
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

/*
 * Disclosure stays a tween. A spring approaches its target asymptotically, and
 * on a height measured in hundreds of pixels that tail runs for over a second
 * before it is inside the rest tolerance. A disclosure has a bounded distance
 * and wants a hard end, which is what a duration gives it.
 */
export const collapseTransition: Transition = {
  duration: 0.24,
  ease: 'easeOut',
};

/*
 * A sidebar column folding to its strip of marks, or back. Width is a layout
 * property and the rules forbid animating it, but this is the argued exception:
 * one bounded region, the same carve-out a height disclosure gets. It is a
 * spring rather than a tween so a second click landing mid-fold carries the
 * current velocity through instead of restarting from a curve, which is the
 * stutter that reads as cheap. Zero bounce: an overshooting width would shove
 * the pane past its resting place and drag it back.
 */
export const foldTransition: Transition = {
  type: 'spring',
  visualDuration: 0.34,
  bounce: 0,
};

/*
 * A control answering a direct gesture: a switch thumb, a tab marker. Fastest
 * of the set with a little life in it, because the reader's finger or key is
 * the cause and the response has to feel immediate.
 */
export const controlTransition: Transition = {
  type: 'spring',
  visualDuration: 0.18,
  bounce: 0.2,
};

/*
 * A companion pane sliding out beside the transcript. A fold is a column
 * snapping to its marks and back; this is a surface being revealed, so it takes
 * longer and eases harder into place, the way a macOS drawer glides rather than
 * flicks. Still a spring, so a toggle mid-slide carries its velocity through,
 * and still zero bounce, because an overshooting width would shove the pane past
 * where it stops and drag it back.
 */
export const drawerTransition: Transition = {
  type: 'spring',
  visualDuration: 0.44,
  bounce: 0,
};

/*
 * A figure growing to its value, and the one place a spring is forbidden rather
 * than merely unhelpful: a bar that overshoots shows a number the data does not
 * support and then corrects, so for the length of the overshoot the chart is
 * lying. A tween also lands exactly, where a spring only ever approaches.
 */
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
