import {
  expect,
  test,
  vi,
} from 'vitest';

import { resolveAgentPaths } from './rootsUtils';

test('resolves every agent path on Linux with environment overrides', () => {
  vi.spyOn(process, 'cwd').mockReturnValue('/work');

  const paths = resolveAgentPaths({
    home: '/home/me',
    platform: 'linux',
    env: {
      CLAUDE_CONFIG_DIR: '/claude',
      CODEX_HOME: '/codex',
      CONTINUE_GLOBAL_DIR: '/continue',
      GEMINI_CLI_HOME: '/gemini',
      INTERPRETER_HOME: '/interpreter',
      QWEN_CODE_HOME: '/qwen',
      VIBE_HOME: '/vibe',
      XDG_CONFIG_HOME: '/config',
      XDG_DATA_HOME: '/data',
    },
  });

  expect(Object.keys(paths)).toHaveLength(29);
  expect(paths.claude).toEqual(['/claude']);
  expect(paths.codex).toEqual(['/codex']);
  expect(paths.continue).toEqual(['/continue']);
  expect(paths.gemini).toEqual(['/gemini']);
  expect(paths.openinterpreter).toEqual(['/interpreter']);
  expect(paths.qwen).toEqual(['/qwen']);
  expect(paths.vibe).toContain('/vibe');
  expect(paths.aider).toContain('/work');
  expect(paths.trae).toContain('/config/Trae/User/workspaceStorage');
});

test('uses platform-specific editor locations and default paths', () => {
  const mac = resolveAgentPaths({
    home: '/Users/me',
    platform: 'darwin',
    env: {},
  });
  const windows = resolveAgentPaths({
    home: 'C:/Users/me',
    platform: 'win32',
    env: {},
  });

  expect(mac.copilot[1]).toContain('Library/Application Support/Code/User/workspaceStorage');
  expect(mac.zed[0]).toContain('Library/Application Support/Zed');
  expect(windows.copilot[1]).toContain('AppData/Roaming/Code/User/workspaceStorage');
  expect(windows.cursor[0]).toContain('AppData/Roaming/Cursor/User/workspaceStorage');
  expect(mac.claude[0]).toBe('/Users/me/.claude');
  expect(mac.codex[0]).toBe('/Users/me/.codex');
});
