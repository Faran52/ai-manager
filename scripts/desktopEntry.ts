/**
 * The desktop shell.
 *
 * Electron rather than `deno desktop`, which cannot draw the chrome this app
 * wants: `transparentTitlebar` only colours the bar and leaves the content
 * inset below it, and `frameless` takes the traffic lights away and, on the
 * webview backend, the ability to drag the window at all, because WKWebView
 * ignores `-webkit-app-region` (denoland/deno#35635).
 *
 * The Astro server runs in a utility process (`desktopServer.ts`), so the window
 * is a browser pointed at loopback and every route behaves as it does anywhere.
 */
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  shell,
  utilityProcess,
} from 'electron';
import electronUpdater from 'electron-updater';

import { installUpdate } from './desktopUpdate.ts';

import type { BrowserWindowConstructorOptions, MenuItemConstructorOptions } from 'electron';
import type { UpdateFile } from './desktopUpdate.ts';

interface WaitingRelease {
  readonly version: string;
  readonly files: readonly UpdateFile[];
}

interface ServerReady {
  readonly port: number;
}

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

const UPDATE_PROGRESS = 'app-update-progress';

const preload = fileURLToPath(new URL('./desktopPreload.cjs', import.meta.url));

/*
 * The page speaks the platform's common name rather than Node's build tag, and
 * decides from it whether the menu belongs in a system bar or its own titlebar.
 */
const platform = process.platform === 'win32' ? 'windows' : process.platform;

// Settled in the main process so a second copy of the app cannot race it.
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

const isServerReady = (value: unknown): value is ServerReady => {
  return typeof value === 'object'
    && value !== null
    && 'port' in value
    && typeof value.port === 'number';
};

const serverScript = fileURLToPath(new URL('./desktopServer.ts', import.meta.url));

let serverProcess: ReturnType<typeof utilityProcess.fork> | undefined;
let quitting = false;

const serve = async (): Promise<string> => {
  const requested = await isFree(PORT) ? String(PORT) : '0';

  // utilityProcess refuses to fork before this, and awaiting it is only safe
  // because serve() is called without being awaited.
  await app.whenReady();

  const child = utilityProcess.fork(serverScript, [], {
    serviceName: 'AI Manager server',
    env: {
      ...process.env,
      ASTRO_NODE_AUTOSTART: 'disabled',
      HOST,
      PORT: requested,
    },
  });

  serverProcess = child;

  // A window with no server behind it is worse than no window.
  child.once('exit', () => {
    if (!quitting) {
      app.quit();
    }
  });

  const port = await new Promise<number>((settle, fail) => {
    child.once('message', (message: unknown) => {
      if (isServerReady(message)) {
        settle(message.port);
      }
      else {
        fail(new Error('the app server is listening on no port'));
      }
    });
  });

  return `http://${HOST}:${String(port)}`;
};

/*
 * Started now, awaited where the answer is needed. Electron emits `ready` only
 * once this module has finished evaluating, so a top-level await here leaves
 * `app.whenReady()` pending forever and no window is ever made.
 */
const origin = serve();

app.on('will-quit', () => {
  quitting = true;
  serverProcess?.kill();
});

let mainWindow: BrowserWindow | undefined;

/* The windows that are not the main one, kept by the route each one shows. */
const panels = new Map<string, BrowserWindow>();

/*
 * An unpainted window is a white rectangle, so a dark app opens with a flash of
 * light. Held back until first paint, by which time the boot script has run.
 */
const shownOnFirstPaint = (window: BrowserWindow): void => {
  window.once('ready-to-show', () => {
    window.show();
  });
};

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
 * Opens one of those, or raises it if it is already up. Choosing About or
 * Settings twice stacking a second copy is the bug this is guarding against,
 * and closing either one leaves the app running.
 */
const openPanel = async (path: string, options: BrowserWindowConstructorOptions): Promise<void> => {
  const already = panels.get(path);

  if (already != null && !already.isDestroyed()) {
    already.focus();

    return;
  }

  const opened = new BrowserWindow({
    ...options,
    show: false,
    webPreferences: { preload },
  });

  shownOnFirstPaint(opened);
  panels.set(path, opened);

  await opened.loadURL(`${await origin}${path}`);
};

/*
 * About is a window of its own rather than a sheet over the app, which is what
 * every other Mac app does with it.
 */
const openAbout = async (): Promise<void> => {
  await openPanel('/about', {
    title: 'About AI Manager',
    width: 360,
    height: 400,
    resizable: false,
  });
};

/*
 * Settings is a window here for the same reason About is: it is where a Mac app
 * keeps it. Wider than About because it carries a rail, and resizable because
 * the panes it will carry are lists.
 */
const openSettings = async (): Promise<void> => {
  await openPanel('/settings', {
    title: 'Settings',
    width: 760,
    height: 520,
    minWidth: 620,
    minHeight: 420,
  });
};

/* What the last check found, which is what installing it downloads. */
let waiting: WaitingRelease | undefined;

/*
 * Three answers, not two: a version is waiting, this build is current, or there
 * is no feed at all. Only a throw is a failure.
 */
const checkForUpdate = async (): Promise<DesktopUpdate> => {
  const unpublished: DesktopUpdate = {
    available: false,
    unpublished: true,
  };

  try {
    const result = await autoUpdater.checkForUpdates();

    if (result == null) {
      return unpublished;
    }

    const { files, version } = result.updateInfo;

    if (version === app.getVersion()) {
      return { available: false };
    }

    waiting = {
      version,
      files,
    };

    return {
      available: true,
      version,
    };
  }
  catch (error) {
    // No channel file, which is what `--publish never` looks like from here.
    if ((error as NodeJS.ErrnoException).code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND') {
      return unpublished;
    }

    throw error;
  }
};

ipcMain.handle('desktop:platform', () => {
  return platform;
});

ipcMain.handle('desktop:menu', (_event, items: readonly AppMenuItem[]) => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(items.map(toMenuItem)));
});

ipcMain.handle('desktop:reveal', (_event, target: string) => {
  shell.showItemInFolder(target);
});

ipcMain.handle('desktop:about', openAbout);

ipcMain.handle('desktop:settings', openSettings);

ipcMain.handle('desktop:update', checkForUpdate);

// The app has to go for its own bundle to be replaced, so this quits into it.
ipcMain.handle('desktop:install', async () => {
  if (waiting == null) {
    throw new Error('no update has been found to install');
  }

  await installUpdate({
    files: waiting.files,
    version: waiting.version,
    onProgress: (fraction) => {
      mainWindow?.webContents.send(UPDATE_PROGRESS, fraction);
    },
    arm64: process.arch === 'arm64',
    // .../AI Manager.app/Contents/MacOS/AI Manager, three up from the bundle.
    bundlePath: resolve(app.getPath('exe'), '../../..'),
    resourcesPath: process.resourcesPath,
    pid: process.pid,
  });

  app.quit();
});

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
    show: false,
    webPreferences: { preload },
  });

  shownOnFirstPaint(window);
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
