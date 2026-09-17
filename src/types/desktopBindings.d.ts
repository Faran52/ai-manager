/* The standard entries the OS draws and handles itself. A subset, because the
   app only asks for the ones it puts in a menu, and a name the shell's toolkit
   does not know is a menu that silently loses an item. */
type AppMenuRole
  = | 'close'
    | 'copy'
    | 'cut'
    | 'minimize'
    | 'paste'
    | 'quit'
    | 'redo'
    | 'selectAll'
    | 'undo';

interface AppMenuEntry {
  readonly label: string;
  readonly id: string;
  readonly accelerator?: string | undefined;
  readonly enabled: boolean;
}

interface AppMenuSubmenu {
  readonly label: string;
  readonly items: readonly AppMenuItem[];
}

/* A menu as the page describes it: a clickable entry, a nested menu, a divider,
   or a role. The app owns the shape so the page can say what belongs in a menu
   without naming whatever is drawing it. */
type AppMenuItem
  = | 'separator'
    | { readonly item: AppMenuEntry }
    | { readonly role: AppMenuRole }
    | { readonly submenu: AppMenuSubmenu };

interface DesktopUpdate {
  readonly available: boolean;
  // The version waiting, once the updater has found one.
  readonly version?: string | undefined;
  // No feed to read, because the release was never published. Not a failure.
  readonly unpublished?: boolean | undefined;
}

/*
 * What the desktop shell exposes to the page. Absent in a browser, so every
 * caller checks before reaching for it, and the app keeps its own in-window
 * controls.
 */
interface DesktopBindings {
  readonly desktopPlatform: () => Promise<string>;
  readonly setApplicationMenu: (items: readonly AppMenuItem[]) => Promise<void>;
  // Present only where these have a window of their own to be raised into.
  readonly openAbout?: (() => Promise<void>)
    | undefined;
  readonly openSettings?: (() => Promise<void>)
    | undefined;
  // Present only where there is an installed build an updater can replace.
  readonly checkForUpdate?: (() => Promise<DesktopUpdate>)
    | undefined;
  /*
   * Downloads what the last check found and quits into the swap, so it settles
   * by the app going and coming back rather than by resolving.
   */
  readonly installUpdate?: (() => Promise<void>)
    | undefined;
}

interface Window {
  readonly bindings?: DesktopBindings | undefined;
}

/* Dispatched on `window` by the desktop shell when a menu item is clicked.
   The detail is still checked against the known commands: the type says what
   is sent, not what must have arrived across a process boundary. */
interface WindowEventMap {
  'app-menu-command': CustomEvent<string>;
}
