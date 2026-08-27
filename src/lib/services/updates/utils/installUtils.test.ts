import {
  describe,
  expect,
  test,
} from 'vitest';

import { helperScriptFor, installCommandFor } from './installUtils';

const request = {
  appPath: '/Applications/AI Chat Manager.app',
  archivePath: '/tmp-staging/update.zip',
  helperPath: '/tmp-staging/swap.sh',
  pid: 4242,
  stagingDir: '/tmp-staging/unpacked',
};

describe('installCommandFor', () => {
  test('hands windows to msiexec without a helper', () => {
    const command = installCommandFor('windows', request);

    expect(command.command).toBe('msiexec');
    expect(command.args).toEqual(['/i', request.archivePath, '/passive', '/norestart']);
  });

  test('hands macos and linux to the waiting helper', () => {
    for (const platform of ['darwin', 'linux'] as const) {
      const command = installCommandFor(platform, request);

      expect(command.command).toBe('/bin/sh');
      expect(command.args[0]).toBe(request.helperPath);
      expect(command.args[1]).toBe('4242');
      expect(command.args).toContain(request.appPath);
    }
  });
});

describe('helperScriptFor', () => {
  test('waits for the old process before swapping', () => {
    expect(helperScriptFor('darwin')).toContain('kill -0');
    expect(helperScriptFor('darwin')).toContain('com.apple.quarantine');
    expect(helperScriptFor('linux')).toContain('chmod +x');
    expect(helperScriptFor('windows')).toBeUndefined();
  });
});
