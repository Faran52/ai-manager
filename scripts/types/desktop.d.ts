/* The slice of the `deno desktop` runtime the entry uses. This repo typechecks
   under Node, which has no Deno global, and Deno's own lib would be a
   dependency carried for the sake of a few members. */
declare namespace Deno {
  interface BrowserWindowOptions {
    // Initial width in logical pixels.
    width?: number;
    // Initial height in logical pixels.
    height?: number;
    // Blends the title bar into the content rather than leaving it system grey.
    transparentTitlebar?: boolean;
    // Window title. macOS draws it centred in the bar.
    title?: string;
    // A panel the reader cannot drag out of shape.
    resizable?: boolean;
  }

  /* A tagged union: a clickable entry, a nested menu, a divider, or one of the
     standard roles the OS draws and handles itself. */
  type MenuItem
    = | {
      item: {
        label: string;
        id?: string;
        accelerator?: string;
        enabled: boolean;
      };
    }
    | {
      submenu: {
        label: string;
        items: MenuItem[];
      };
    }
    | 'separator'
    | { role: { role: string } };

  // Only an item carrying an id reports a click; a role is handled by the OS.
  interface MenuClickEvent extends Event {
    readonly detail: { readonly id: string };
  }

  class BrowserWindow {
    constructor(options?: BrowserWindowOptions);

    addEventListener(type: 'close', listener: () => void): void;

    addEventListener(type: 'menuclick', listener: (event: MenuClickEvent) => void): void;

    /* The macOS menu bar, or the window's own menu on Windows and Linux. */
    setApplicationMenu(items: MenuItem[]): void;

    /* Exposes a function to the page, which calls it as `bindings.<name>()`. */
    bind(name: string, handler: (...args: never[]) => Promise<unknown>): void;

    // Runs in the page's main world and resolves with a JSON-serialisable result.
    executeJs(code: string): Promise<unknown>;

    // Points the window at a URL. A second window opens blank until it is sent somewhere.
    navigate(url: string): void;

    focus(): void;

    close(): void;

    isClosed(): boolean;
  }

  function exit(code: number): never;

  interface Env {
    get(key: string): string | undefined;
  }

  const env: Env;

  interface Build {
    readonly os: string;
  }

  const build: Build;
}

/* Resolution only: the built server entry exists after `astro build`, and dist
   sits outside this project's tsconfig. */
declare module '*entry.mjs';
