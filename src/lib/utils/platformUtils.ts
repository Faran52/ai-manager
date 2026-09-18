export type DesktopPlatform = 'mac' | 'windows' | 'linux';

/*
 * The synchronous read. `bindings.desktopPlatform()` is the authority but it is a
 * round trip, and a menu label has to be decided while the menu is being built.
 */
export const browserPlatform = (): DesktopPlatform => {
  if (navigator.platform.startsWith('Mac')) {
    return 'mac';
  }

  return navigator.platform.startsWith('Win') ? 'windows' : 'linux';
};

export const isApplePlatform = (): boolean => {
  return browserPlatform() === 'mac';
};
