import { useState } from 'react';

/*
 * Whether the app is running as an installed build rather than in a browser.
 *
 * The one place that question is answered, so a feature that only makes sense
 * on a desktop asks this rather than each caller inventing its own test out of
 * the user agent or the platform. It cannot change while the page is up, so it
 * is read once.
 */
export const useDesktop = (): boolean => {
  const [desktop] = useState(() => {
    return window.bindings != null;
  });

  return desktop;
};
