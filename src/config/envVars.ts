/*
 * Environment read once, at the edge, so nothing else reaches for process.env.
 * The static member access is what lets the bundler substitute the literal, so
 * these cannot be looked up by a computed key. Everything here reaches clients.
 */

// Unset has to arrive as undefined, not '': a blank public key reads as a key
// that was configured, which makes the updater reject every feed it is offered.
export const envVar = (baked: string, live: string | undefined): string | undefined => {
  const value = baked.length > 0 ? baked : live;

  return value != null && value.length > 0 ? value : undefined;
};

// The client bundle has no `process`. A production build compiles the reference
// away, but the dev server leaves it standing, where it throws on hydration.
/* v8 ignore next -- tests always run somewhere `process` exists */
const live = typeof process === 'undefined' ? {} : process.env;

export const UPDATE_FEED_URL = envVar(import.meta.env.UPDATE_FEED_URL, live.UPDATE_FEED_URL);

export const UPDATE_PUBLIC_KEY = envVar(
  import.meta.env.UPDATE_PUBLIC_KEY,
  live.UPDATE_PUBLIC_KEY,
);
