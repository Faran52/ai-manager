/* The built server, which the desktop shell starts in its own process. It
   exists only after `astro build`, and dist sits outside this project's
   tsconfig, so the slice the shell uses is declared rather than imported. */
declare module '*dist/server/entry.mjs' {
  /* Astro's node adapter in standalone mode wraps the listener in a record of
     its own, which is the second `server` here. */
  interface StandaloneListener {
    server: import('node:net').Server;
  }

  interface StartedServer {
    server: StandaloneListener;
  }

  export const startServer: () => StartedServer;
}
