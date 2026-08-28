/**
 * Environment read once, at the edge, so nothing else reaches for `process.env`.
 *
 * `astro.config.mjs` inlines the baked half at build time: a packaged app runs
 * with the user's environment rather than the one that built it, so a release
 * that only read `process.env` would ship with update checking off. The static
 * member access below is what lets the bundler substitute the literal, so these
 * cannot be looked up by a computed key.
 *
 * Anything exported here reaches the client bundle through the config barrel,
 * so only values safe to publish belong in this file.
 */

// Unset has to arrive as undefined, not '': a blank public key reads as a key
// that was configured, which makes the updater reject every feed it is offered.
export const envVar = (baked: string, live: string | undefined): string | undefined => {
  const value = baked.length > 0 ? baked : live;

  return value != null && value.length > 0 ? value : undefined;
};

export const UPDATE_FEED_URL = envVar(import.meta.env.UPDATE_FEED_URL, process.env.UPDATE_FEED_URL);

export const UPDATE_PUBLIC_KEY = envVar(
  import.meta.env.UPDATE_PUBLIC_KEY,
  process.env.UPDATE_PUBLIC_KEY,
);
