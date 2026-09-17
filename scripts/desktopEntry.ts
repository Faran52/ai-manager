/**
 * The desktop shell.
 *
 * Electron rather than `deno desktop`, which cannot draw the chrome this app
 * wants: `transparentTitlebar` only colours the bar and leaves the content
 * inset below it, and `frameless` takes the traffic lights away and, on the
 * webview backend, the ability to drag the window at all, because WKWebView
 * ignores `-webkit-app-region` (denoland/deno#35635).
 *
 * The Astro server runs in this process. It is the same `dist/server/entry.mjs`
 * a hosted deployment runs, so the window is a browser pointed at loopback and
 * every route, API and asset behaves as it does anywhere else.
 */
import { once } from 'node:events';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
} from 'electron';
import electronUpdater from 'electron-updater';

import type { MenuItemConstructorOptions } from 'electron';

// electron-updater is CommonJS, so ESM sees the default export rather than the
// named ones its types advertise.
const { autoUpdater } = electronUpdater;

/*
 * The product's name, not the package's. The roles the OS fills in for itself
 * read it, so without this the Quit item says "Quit ai-manager". Set before
 * `ready`, which is what also puts the app's stored state under that name.
 */
app.setName('AI Manager');

const HOST = '127.0.0.1';

/*
 * A fixed port, because everything the page remembers is keyed by its origin.
 * On an ephemeral port that origin changes every launch, so the theme, the
 * language, the sidebar width and every other stored preference come back
 * empty and the app looks freshly installed each time.
 *
 * If something else already holds it the app still starts, on whatever port it
 * is given, and that session remembers nothing. The lock below is what keeps
 * the usual cause of that, a second copy of this app, from happening.
 */
const PORT = 41_780;

// The event the page listens for, declared in src/types/desktopBindings.d.ts.
const MENU_COMMAND = 'app-menu-command';

const preload = fileURLToPath(new URL('./desktopPreload.cjs', import.meta.url));

/*
 * The page speaks the platform's common name rather than Node's build tag, and
 * decides from it whether the menu belongs in a system bar or its own titlebar.
 */
const platform = process.platform === 'win32' ? 'windows' : process.platform;

/**
 * The server this process holds, and where it ended up listening.
 *
 * Loopback, and a port the OS picks: a fixed one collides with a second copy of
 * the app, and binding anywhere else would publish an API that deletes projects
 * and runs the CLI to the network. The server starts itself on import, which is
 * too early, so autostart is off and the port is settled before anything is
 * pointed at it.
 */
const isFree = async (port: number): Promise<boolean> => {
  const probe = createServer();

  try {
    await new Promise<void>((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(port, HOST, resolve);
    });

    return true;
  }
  catch {
    return false;
  }
  finally {
    probe.close();
  }
};

const serve = async (): Promise<string> => {
  process.env.ASTRO_NODE_AUTOSTART = 'disabled';
  process.env.HOST = HOST;
  process.env.PORT = await isFree(PORT) ? String(PORT) : '0';

  const { startServer } = await import('../dist/server/entry.mjs');
  const listener = startServer().server.server;

  await once(listener, 'listening');

  const address = listener.address();

  // A string address is a unix socket, which this never is.
  if (typeof address !== 'object' || address === null) {
    throw new Error('the app server is listening on no port');
  }

  return `http://${HOST}:${String(address.port)}`;
};

/*
 * Started now, awaited where the answer is needed. Electron emits `ready` only
 * once this module has finished evaluating, so a top-level await here leaves
 * `app.whenReady()` pending forever and no window is ever made.
 */
const origin = serve();

let mainWindow: BrowserWindow | undefined;
let aboutWindow: BrowserWindow | undefined;
let settingsWindow: BrowserWindow | undefined;

/*
 * Electron's own menu description, built from the page's. The page holds the
 * labels in the reader's language and the ids its handlers already know, so it
 * describes the menu and this translates it.
 */
const toMenuItem = (item: AppMenuItem): MenuItemConstructorOptions => {
  if (item === 'separator') {
    return { type: 'separator' };
  }

  if ('role' in item) {
    return { role: item.role };
  }

  if ('submenu' in item) {
    return {
      label: item.submenu.label,
      submenu: item.submenu.items.map(toMenuItem),
    };
  }

  const {
    accelerator,
    enabled,
    id,
    label,
  } = item.item;

  return {
    label,
    enabled,
    // Omitted rather than undefined: an absent accelerator is not a blank one.
    ...accelerator == null ? {} : { accelerator },
    click: () => {
      mainWindow?.webContents.send(MENU_COMMAND, id);
    },
  };
};

/*
 * About is a window of its own rather than a sheet over the app, which is what
 * every other Mac app does with it. Choosing it twice raises the one already
 * open instead of stacking a second, and closing it leaves the app running.
 */
const openAbout = async (): Promise<void> => {
  if (aboutWindow != null && !aboutWindow.isDestroyed()) {
    aboutWindow.focus();

    return;
  }

  const opened = new BrowserWindow({
    title: 'About AI Manager',
    width: 360,
    height: 400,
    resizable: false,
    webPreferences: { preload },
  });

  aboutWindow = opened;

  await opened.loadURL(`${await origin}/about`);
};

/*
 * Settings is a window here for the same reason About is: it is where a Mac app
 * keeps it. Wider than About because it carries a rail, and resizable because
 * the panes it will carry are lists.
 */
const openSettings = async (): Promise<void> => {
  if (settingsWindow != null && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();

    return;
  }

  const opened = new BrowserWindow({
    title: 'Settings',
    width: 760,
    height: 520,
    minWidth: 620,
    minHeight: 420,
    webPreferences: { preload },
  });

  settingsWindow = opened;

  await opened.loadURL(`${await origin}/settings`);
};

/*
 * electron-updater, against the feed electron-builder publishes. It answers
 * null where it has no feed to read, and a throw travels back to the page as a
 * rejection, which is what a failed check is: not the same as being current.
 */
const checkForUpdate = async (): Promise<DesktopUpdate> => {
  const result = await autoUpdater.checkForUpdates();
  const version = result?.updateInfo.version;

  return version != null && version !== app.getVersion()
    ? {
        available: true,
        version,
      }
    : { available: false };
};

ipcMain.handle('desktop:platform', () => {
  return platform;
});

ipcMain.handle('desktop:menu', (_event, items: readonly AppMenuItem[]) => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(items.map(toMenuItem)));
});

ipcMain.handle('desktop:about', openAbout);

ipcMain.handle('desktop:settings', openSettings);

ipcMain.handle('desktop:update', checkForUpdate);

/*
 * hiddenInset keeps the traffic lights and drops the bar they sit in, so the
 * app's own first row runs to the top of the window. The lights are then placed
 * on the centre line of that row, which AppHeader.css sets to 42px tall, and
 * the row reserves the width they need on its leading edge.
 */
const openMain = async (): Promise<void> => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: {
      x: 13,
      y: 15,
    },
    webPreferences: { preload },
  });

  mainWindow = window;

  // Only this window ends the app. A secondary window closing leaves it running.
  window.on('closed', () => {
    app.quit();
  });

  await window.loadURL(await origin);
};

/*
 * A second copy would start a second server, take a different port and keep
 * its settings somewhere else. The one already running is raised instead.
 */
if (app.requestSingleInstanceLock()) {
  app.on('second-instance', () => {
    mainWindow?.focus();
  });

  /* Not a top-level await: `ready` only comes once this module has finished
     evaluating, so waiting for it out here would wait forever. */
  void (async () => {
    await app.whenReady();
    await openMain();
  })();
}
else {
  app.quit();
}
