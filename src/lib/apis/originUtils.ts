/**
 * The desktop app is a webview onto a loopback HTTP server, so the port that
 * serves the window is reachable by every other page the user has open. The
 * same-origin policy stops a foreign page reading a reply, but not sending the
 * request, and this API deletes projects and sessions, rewrites settings and
 * runs the Claude CLI. A browser attaches `Origin` to exactly those
 * state-changing requests, and one naming another site is never a request the
 * app made of itself.
 *
 * ponytail: a header check, not a token. The window and the server share a
 * process, so there is no second party to hold a secret; if the API ever
 * answers something other than this app's own webview, give it real auth.
 */
export const isForeignOrigin = (origin: string | null, self: string): boolean => {
  return origin != null && origin !== self;
};
