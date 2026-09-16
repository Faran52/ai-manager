import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { LOADER_MIN_MS } from '../constants';

// Holds a wait on screen for a beat, so a read that lands instantly is still seen.
export const useMinLoad = (loading: boolean, minMs = LOADER_MIN_MS): boolean => {
  const heldUntilRef = useRef(0);
  const [held, setHeld] = useState(false);

  // A new wait starts the beat, adjusted during render as useLastPresent does.
  if (loading && !held) {
    setHeld(true);
  }

  useEffect(() => {
    if (loading) {
      heldUntilRef.current = Date.now() + minMs;

      return undefined;
    }

    if (!held) {
      return undefined;
    }

    // Negative on a slow read, which fires at once: the beat was long since served.
    const timer = setTimeout(() => {
      setHeld(false);
    }, heldUntilRef.current - Date.now());

    return () => {
      clearTimeout(timer);
    };
  }, [held, loading, minMs]);

  return loading || held;
};
