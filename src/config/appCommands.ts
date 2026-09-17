/*
 * What the native menu can ask the app to do. The desktop entry builds the menu
 * from this list and sends the clicked id back as `appMenuEvent`.
 */
export type AppCommand
  = | 'about'
    | 'settings'
    | 'viewSessions'
    | 'viewAnalytics'
    | 'viewHealth'
    | 'viewArchive'
    | 'reload'
    | 'showShortcuts';

// Dispatched on `window` by the desktop entry, carrying an AppCommand as detail.
export const appMenuEvent = 'app-menu-command';

export const isAppCommand = (value: string): value is AppCommand => {
  return APP_COMMANDS.has(value);
};

const APP_COMMANDS: ReadonlySet<string> = new Set<AppCommand>([
  'about',
  'settings',
  'viewSessions',
  'viewAnalytics',
  'viewHealth',
  'viewArchive',
  'reload',
  'showShortcuts',
]);
