/**
 * Shared by the banner and the probe tests: the smallest `window.bindings` an
 * update check needs, with the installer only present when a test asks for it,
 * because the probe branches on whether the shell exposes one.
 */
export const stubUpdater = (
  checkForUpdate: () => Promise<DesktopUpdate>,
  installUpdate?: () => Promise<void>,
): void => {
  Object.defineProperty(window, 'bindings', {
    configurable: true,
    value: {
      desktopPlatform: () => {
        return Promise.resolve('darwin');
      },
      setApplicationMenu: () => {
        return Promise.resolve(undefined);
      },
      checkForUpdate,
      ...installUpdate == null ? {} : { installUpdate },
    },
  });
};
