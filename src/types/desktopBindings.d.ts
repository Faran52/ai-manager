/*
 * What `deno desktop` exposes to the page. Absent in a browser, so every caller
 * checks before reaching for it, and the app keeps its own in-window controls.
 */
interface DesktopBindings {
  readonly desktopPlatform: () => Promise<string>;
  readonly setApplicationMenu: (items: readonly Deno.MenuItem[]) => Promise<void>;
  // Present only where About has a window of its own to be raised into.
  readonly openAbout?: (() => Promise<void>)
    | undefined;
}

interface Window {
  readonly bindings?: DesktopBindings | undefined;
}

/* Dispatched on `window` by the desktop entry when a menu item is clicked.
   The detail is still checked against the known commands: the type says what
   is sent, not what must have arrived across a process boundary. */
interface WindowEventMap {
  'app-menu-command': CustomEvent<string>;
}
