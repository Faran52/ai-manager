/*
 * The desktop app is a webview onto a loopback server, so its port is reachable
 * by every page the user has open, and this API deletes projects and runs the
 * CLI. ponytail: a header check, not a token. Real auth if it serves anyone else.
 */
export const isForeignOrigin = (origin: string | null, self: string): boolean => {
  return origin != null && origin !== self;
};
