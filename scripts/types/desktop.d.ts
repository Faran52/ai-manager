/* The slice of the `deno desktop` runtime the entry uses. This repo typechecks
   under Node, which has no Deno global, and Deno's own lib would be a
   dependency carried for the sake of two members. */
declare namespace Deno {
  class BrowserWindow extends EventTarget {}

  function exit(code: number): never;
}

/* Resolution only: the built server entry exists after `astro build`, and dist
   sits outside this project's tsconfig. */
declare module '*entry.mjs';
