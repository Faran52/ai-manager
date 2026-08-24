import { useState } from 'react';

// Keeps a dialog's content through its exit animation; without it the text blanks
// the moment the target clears and the animation plays against an empty surface.
export const useLastPresent = <T>(value: T | null | undefined): T | undefined => {
  const [last, setLast] = useState<T | undefined>(undefined);

  if (value != null && value !== last) {
    setLast(value);
  }

  return value ?? last;
};
