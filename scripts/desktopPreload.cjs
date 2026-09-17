/**
 * The page's side of the desktop shell.
 *
 * CommonJS, and plain JavaScript, which nothing else in this repo is: Electron
 * loads a sandboxed preload with `require` into an isolated world and supports
 * neither ES modules nor the type stripping the main process runs on. Keeping
 * the sandbox on is what keeps Node out of the page, so this holds the plumbing
 * and no logic at all.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bindings', {
  desktopPlatform: () => {
    return ipcRenderer.invoke('desktop:platform');
  },
  setApplicationMenu: (items) => {
    return ipcRenderer.invoke('desktop:menu', items);
  },
  // Windows keeps About and Settings in the app, so it is offered neither.
  ...process.platform === 'win32'
    ? {}
    : {
        openAbout: () => {
          return ipcRenderer.invoke('desktop:about');
        },
        openSettings: () => {
          return ipcRenderer.invoke('desktop:settings');
        },
      },
  checkForUpdate: () => {
    return ipcRenderer.invoke('desktop:update');
  },
});

// A menu click lands in the main process, so it is handed back to the page as
// the event the page's own handlers already listen for.
ipcRenderer.on('app-menu-command', (_event, id) => {
  window.dispatchEvent(new CustomEvent('app-menu-command', { detail: id }));
});

/*
 * Only macOS keeps the window's buttons over the app's own first row, and only
 * the stylesheet knows how much room that takes, so it is told which platform
 * it is on. Waited for, because a preload runs before there is an html element
 * to mark.
 */
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.dataset.desktop = process.platform;
});
