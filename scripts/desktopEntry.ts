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
 * to land — and it is the only place the window itself gets configured. The
 * `desktop` block in deno.json sets nothing about the window (app metadata,
 * backend, output, code signing, the update feed and error reporting are the
 * whole of it), so the initial size lives here: `width` and `height` are
 * logical pixels and 800×600 otherwise, too small for the sidebar and the
 * transcript to sit side by side. A minimum size was the other part worth
 * having and does not exist — no option on the constructor, no setter on the
 * window. The title bar styles the docs offer (`frameless`,
 * `transparentTitlebar`) are creation-only, and blending the title bar into
 * the content gives the traffic lights the page's top-left corner, so none is
 * set until the header is drawn to host them.
 */
import '../dist/server/entry.mjs';

const mainWindow = new Deno.BrowserWindow({
  width: 1440,
  height: 900,
});

mainWindow.addEventListener('close', (): void => {
  Deno.exit(0);
});
