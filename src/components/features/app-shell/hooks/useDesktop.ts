import { useState } from 'react';

/*
 * Whether the app is an installed build rather than a browser tab: the one place
 * that is answered. It cannot change while the page is up, so it is read once.
 */
export const useDesktop = (): boolean => {
  const [desktop] = useState(() => {
    return window.bindings != null;
  });

  return desktop;
};
