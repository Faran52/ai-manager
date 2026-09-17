import type { AppCommand } from '@config/appCommands';

// Translates one of the keys below into the reader's own language.
type Label = (key: string) => string;

/* macOS replaces the first submenu's label with the bundle name, so this shows
   only where it is not substituted. A proper noun either way. */
const APP_NAME = 'AI Manager';

// The rail and the shortcut sheet already name these things; the menu says the
// same words rather than a second set that could drift from them.
const MENU_KEYS: Record<AppCommand, string> = {
  about: 'settingsAbout',
  settings: 'navSettings',
  viewSessions: 'navSessions',
  viewAnalytics: 'navAnalytics',
  viewHealth: 'navHealth',
  viewArchive: 'navArchive',
  reload: 'refresh',
  showShortcuts: 'shortcuts',
};

const entry = (label: Label, id: AppCommand, accelerator?: string): AppMenuItem => {
  const item = {
    label: label(MENU_KEYS[id]),
    id,
    enabled: true,
  };

  return {
    item: accelerator == null
      ? item
      : {
          ...item,
          accelerator,
        },
  };
};

const role = (name: AppMenuRole): AppMenuItem => {
  return { role: name };
};

/*
 * The standard arrangement. Cut, copy, paste and select all are roles, not items:
 * a webview takes those from the menu, and without one the shortcuts are gone.
 */
export const applicationMenu = (label: Label): readonly AppMenuItem[] => {
  return [
    {
      submenu: {
        label: APP_NAME,
        items: [
          entry(label, 'about'),
          'separator',
          entry(label, 'settings', 'CmdOrCtrl+,'),
          'separator',
          role('quit'),
        ],
      },
    },
    {
      submenu: {
        label: label('menuEdit'),
        items: [
          role('undo'),
          role('redo'),
          'separator',
          role('cut'),
          role('copy'),
          role('paste'),
          role('selectAll'),
        ],
      },
    },
    {
      submenu: {
        label: label('menuView'),
        items: [
          entry(label, 'viewSessions', 'CmdOrCtrl+1'),
          entry(label, 'viewAnalytics', 'CmdOrCtrl+2'),
          entry(label, 'viewHealth', 'CmdOrCtrl+3'),
          entry(label, 'viewArchive', 'CmdOrCtrl+4'),
          'separator',
          entry(label, 'reload', 'CmdOrCtrl+R'),
        ],
      },
    },
    {
      submenu: {
        label: label('menuWindow'),
        items: [role('minimize'), role('close')],
      },
    },
    {
      submenu: {
        label: label('menuHelp'),
        items: [entry(label, 'showShortcuts')],
      },
    },
  ];
};
