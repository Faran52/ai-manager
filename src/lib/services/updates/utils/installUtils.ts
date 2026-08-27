import type { InstallCommand, UpdatePlatform } from '../types';

export interface InstallRequest {
  readonly appPath: string;
  readonly archivePath: string;
  readonly helperPath: string;
  readonly pid: number;
  readonly stagingDir: string;
}

// A running app cannot replace its own bundle, so a detached helper does it
// after we exit. This mirrors how Sparkle delegates to its Updater helper.
const MACOS_HELPER = `#!/bin/sh
set -e
while kill -0 "$1" 2>/dev/null; do sleep 0.2; done
/usr/bin/ditto -xk "$2" "$3"
/usr/bin/xattr -dr com.apple.quarantine "$4" 2>/dev/null || true
/usr/bin/open "$4"
`;

// AppImage is a single file, so the swap is a move once the old one is unmounted.
const LINUX_HELPER = `#!/bin/sh
set -e
while kill -0 "$1" 2>/dev/null; do sleep 0.2; done
mv -f "$2" "$4"
chmod +x "$4"
"$4" &
`;

export const helperScriptFor = (platform: UpdatePlatform): string | undefined => {
  if (platform === 'darwin') {
    return MACOS_HELPER;
  }

  return platform === 'linux' ? LINUX_HELPER : undefined;
};

export const installCommandFor = (
  platform: UpdatePlatform,
  request: InstallRequest,
): InstallCommand => {
  if (platform === 'windows') {
    // msiexec replaces files once we are gone, so no helper is needed.
    return {
      command: 'msiexec',
      args: ['/i', request.archivePath, '/passive', '/norestart'],
    };
  }

  // macOS and Linux both wait for this process to exit, then swap and relaunch.
  return {
    command: '/bin/sh',
    args: [
      request.helperPath,
      String(request.pid),
      request.archivePath,
      request.stagingDir,
      request.appPath,
    ],
  };
};
