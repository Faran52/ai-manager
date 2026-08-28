import { useEffect } from 'react';

import {
  BASELINE_FRAME_MS,
  MAX_FRAME_MS,
  REDUCED_MOTION_QUERY,
  SMOOTH_EPSILON,
  SMOOTH_FACTOR,
  SYNC_TOLERANCE,
  WHEEL_LINE_PX,
} from '../constants';

interface SmoothState {
  current: number;
  target: number;
  rafId: number;
  lastNow: number;
}

// Firefox reports wheel deltas in lines or pages rather than pixels.
const DELTA_MODE_LINE = 1;
const DELTA_MODE_PAGE = 2;

const wheelDelta = (event: WheelEvent, viewportHeight: number): number => {
  if (event.deltaMode === DELTA_MODE_LINE) {
    return event.deltaY * WHEEL_LINE_PX;
  }

  return event.deltaMode === DELTA_MODE_PAGE ? event.deltaY * viewportHeight : event.deltaY;
};

/**
 * Eases an element's own scrolling instead of letting the wheel drive it
 * directly, so a transcript glides to a stop rather than jumping per notch.
 *
 * The step is scaled by elapsed time rather than by frame count, so the same
 * gesture travels the same distance whether the display runs at 60Hz or 120Hz.
 * Anyone who asked for reduced motion keeps the platform's own scrolling.
 */
export const useSmoothScroll = (element: HTMLElement | null): void => {
  useEffect(() => {
    if (element == null || window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      return undefined;
    }

    const state: SmoothState = {
      current: element.scrollTop,
      target: element.scrollTop,
      rafId: 0,
      lastNow: 0,
    };

    const furthest = (): number => {
      return Math.max(0, element.scrollHeight - element.clientHeight);
    };

    const run = (now: number): void => {
      // A tab in the background stops painting, and the gap on return would
      // otherwise resolve in one teleporting frame.
      const elapsed = state.lastNow === 0 ? BASELINE_FRAME_MS : Math.min(now - state.lastNow, MAX_FRAME_MS);
      const distance = state.target - state.current;

      state.lastNow = now;

      if (Math.abs(distance) < SMOOTH_EPSILON) {
        state.current = state.target;
        state.rafId = 0;
        state.lastNow = 0;
        element.scrollTop = state.target;

        return;
      }

      state.current += distance * (1 - (1 - SMOOTH_FACTOR) ** (elapsed / BASELINE_FRAME_MS));
      element.scrollTop = state.current;
      state.rafId = requestAnimationFrame(run);
    };

    const kick = (): void => {
      if (state.rafId === 0) {
        state.rafId = requestAnimationFrame(run);
      }
    };

    const onWheel = (event: WheelEvent): void => {
      if (event.ctrlKey || event.metaKey) {
        return;
      }

      event.preventDefault();
      state.target = Math.min(furthest(), Math.max(0, state.target + wheelDelta(event, element.clientHeight)));
      kick();
    };

    // Anything else that scrolls, a keyboard, a scrollbar drag, a jump to a
    // search hit, owns the position outright rather than fighting the easing.
    const onScroll = (): void => {
      if (Math.abs(element.scrollTop - state.current) <= SYNC_TOLERANCE) {
        return;
      }

      state.current = element.scrollTop;
      state.target = element.scrollTop;

      if (state.rafId !== 0) {
        cancelAnimationFrame(state.rafId);
        state.rafId = 0;
        state.lastNow = 0;
      }
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(state.rafId);
    };
  }, [element]);
};
