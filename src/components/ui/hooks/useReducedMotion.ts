import { useSyncExternalStore } from 'react';

import { REDUCED_MOTION_QUERY } from '../constants';

const subscribe = (notify: () => void): (() => void) => {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);

  media.addEventListener('change', notify);

  return () => {
    media.removeEventListener('change', notify);
  };
};

const prefersReduced = (): boolean => {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
};

// The global prefers-reduced-motion CSS rule cannot reach Motion, which drives
// height and opacity through requestAnimationFrame.
export const useReducedMotion = (): boolean => {
  return useSyncExternalStore(subscribe, prefersReduced);
};
