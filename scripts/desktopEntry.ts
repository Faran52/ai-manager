/**
 * The desktop entry point.
 *
 * `deno desktop` opens the native window before it runs this module, and the
 * entry it generates by default is a bare import of the built server. That
 * leaves nothing on the JavaScript side holding the window, so the close button
 * had no handler behind it: clicking it left the window open and the process
 * running, and the app could only be quit from the menu.
 *
 * Constructing the first BrowserWindow adopts the one already on screen rather
 * than opening a second, which is what finally gives the close event somewhere
 * to land. It is also the only place the window is configured: the `desktop`
 * block in deno.json sets nothing about it, and the 800x600 default is too
 * small for the sidebar and the transcript side by side. `width` and `height`
 * are logical pixels. A minimum size has no constructor option or setter.
 *
 * transparentTitlebar does reach the adopted window: the bar takes the app's
 * own surface instead of reading as system grey. It does not remove the bar,
 * so the traffic lights and the centred title still sit in a strip of their
 * own rather than on the app's first row.
 *
 * The menu is described by the page rather than here. The page holds the labels
 * in the reader's own language and the ids its handlers already know, so this
 * forwards in both directions and decides nothing.
 */
import '../dist/server/entry.mjs';

const mainWindow = new Deno.BrowserWindow({
  width: 1440,
  height: 900,
  transparentTitlebar: true,
});

// Which menu belongs in the window and which in the system bar is the page's
// call, so it is told the platform rather than asked to guess from the agent.
mainWindow.bind('desktopPlatform', (): Promise<string> => {
  return Promise.resolve(Deno.build.os);
});

mainWindow.bind('setApplicationMenu', (items: Deno.MenuItem[]): Promise<void> => {
  mainWindow.setApplicationMenu(items);

  return Promise.resolve();
});

/*
 * Where the server this process just started is listening. A second window
 * opens blank and has to be sent somewhere, and only this side knows the port.
 */
const servedAt = (path: string): string => {
  const port = (Deno.env.get('DENO_SERVE_ADDRESS') ?? '').split(':').pop() ?? '';

  return `http://127.0.0.1:${port}${path}`;
};

let aboutWindow: Deno.BrowserWindow | undefined;

/*
 * About is a window of its own on this platform rather than a sheet over the
 * app, which is what every other Mac app does with it. Choosing it twice
 * raises the one already open instead of stacking a second.
 */
mainWindow.bind('openAbout', (): Promise<void> => {
  if (aboutWindow != null && !aboutWindow.isClosed()) {
    aboutWindow.focus();

    return Promise.resolve();
  }

  const opened = new Deno.BrowserWindow({
    title: 'About AI Manager',
    width: 360,
    height: 400,
    resizable: false,
  });

  opened.navigate(servedAt('/about'));

  /*
   * The close button is a request, not the act. Without this the button does
   * nothing, the same way the main window needed a handler before it would
   * shut, and this one closes the window rather than ending the process.
   */
  opened.addEventListener('close', (): void => {
    opened.close();
  });

  aboutWindow = opened;

  return Promise.resolve();
});

/*
 * A click lands here, not in the page, so it is handed back as an event on
 * `window`. The id is one this page supplied a moment ago; stringifying it
 * keeps that true even if a label ever carries a quote.
 */
mainWindow.addEventListener('menuclick', (event): void => {
  const detail = JSON.stringify(event.detail.id);

  void mainWindow.executeJs(
    `window.dispatchEvent(new CustomEvent('app-menu-command', { detail: ${detail} }))`,
  );
});

// Only this window ends the process. A secondary window closing leaves the app up.
mainWindow.addEventListener('close', (): void => {
  Deno.exit(0);
});
