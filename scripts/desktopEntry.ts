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
 * are logical pixels. A minimum size has no constructor option or setter, and
 * the title bar options are creation-only, so neither is set here.
 */
import '../dist/server/entry.mjs';

const mainWindow = new Deno.BrowserWindow({
  width: 1440,
  height: 900,
});

mainWindow.addEventListener('close', (): void => {
  Deno.exit(0);
});
