import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  expect,
  test,
  vi,
} from 'vitest';

import { resolveAgentPaths, rootProfileLabel } from './rootsUtils';

test('resolves every agent path on Linux with environment overrides', () => {
  vi.spyOn(process, 'cwd').mockReturnValue('/home/me/work');

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
  expect(paths.gemini).toEqual(['/gemini/tmp']);
  expect(paths.openinterpreter).toEqual(['/interpreter']);
  expect(paths.qwen).toEqual(['/qwen']);
  expect(paths.vibe).toContain('/vibe');
  expect(paths.aider).toContain('/home/me/work');
  expect(paths.trae).toContain('/config/Trae/User/workspaceStorage');
});

test('ignores a working directory that sits outside the home directory', () => {
  vi.spyOn(process, 'cwd').mockReturnValue('/');

  const paths = resolveAgentPaths({
    home: '/home/me',
    platform: 'linux',
    env: {},
  });

  expect(paths.aider).toEqual(['/home/me/src', '/home/me/Projects', '/home/me/Developer']);
  expect(paths.aider).not.toContain('/');
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

  expect(mac.copilot[0]).toContain('Library/Application Support/Code/User/workspaceStorage');
  expect(mac.zed[0]).toContain('Library/Application Support/Zed');
  expect(windows.copilot[0]).toContain('AppData/Roaming/Code/User/workspaceStorage');
  expect(windows.cursor[0]).toContain('AppData/Roaming/Cursor/User/globalStorage/state.vscdb');
  expect(windows.cursor[1]).toContain('AppData/Roaming/Cursor/User/workspaceStorage');
  expect(mac.claude[0]).toBe('/Users/me/.claude');
  expect(mac.codex[0]).toBe('/Users/me/.codex');
});

test('finds a differently named sibling profile and keeps the default first', async () => {
  const home = await mkdtemp(join(tmpdir(), 'roots-'));

  await mkdir(join(home, '.claude'));
  await mkdir(join(home, '.claude-work'));
  await mkdir(join(home, '.Claude-Personal'));
  await mkdir(join(home, '.codex-alt'));

  const paths = resolveAgentPaths({
    home,
    platform: 'linux',
    env: {},
  });

  expect(paths.claude).toEqual([
    join(home, '.claude'),
    join(home, '.Claude-Personal'),
    join(home, '.claude-work'),
  ]);
  expect(paths.codex).toEqual([join(home, '.codex'), join(home, '.codex-alt')]);
});

test('leaves a file that merely shares the prefix out of the sibling scan', async () => {
  const home = await mkdtemp(join(tmpdir(), 'roots-'));

  await mkdir(join(home, '.claude'));
  await writeFile(join(home, '.claude.json'), '{}');

  const paths = resolveAgentPaths({
    home,
    platform: 'linux',
    env: {},
  });

  expect(paths.claude).toEqual([join(home, '.claude')]);
});

test('labels a sibling by the name that sets it apart from the default', () => {
  expect(rootProfileLabel('/Users/me/.claude-personal', '.claude')).toBe('Personal');
  expect(rootProfileLabel('/Users/me/.Claude-Personal', '.claude')).toBe('Personal');
  expect(rootProfileLabel('/Users/me/.claude_WORK', '.claude')).toBe('Work');
});

test('gives the plain default root no profile label', () => {
  expect(rootProfileLabel('/Users/me/.claude', '.claude')).toBeUndefined();
  expect(rootProfileLabel('/Users/me/.CLAUDE', '.claude')).toBeUndefined();
});

test('gives a root outside the naming convention no profile label', () => {
  expect(rootProfileLabel('/Users/me/custom-claude-dir', '.claude')).toBeUndefined();
});

test('gives a sibling with nothing left after the separator no profile label', () => {
  expect(rootProfileLabel('/Users/me/.claude---', '.claude')).toBeUndefined();
});

test('finds a sibling even where an explicit CLAUDE_CONFIG_DIR points elsewhere', async () => {
  const home = await mkdtemp(join(tmpdir(), 'roots-'));

  await mkdir(join(home, '.claude'));
  await mkdir(join(home, '.claude-work'));

  const paths = resolveAgentPaths({
    home,
    platform: 'linux',
    env: { CLAUDE_CONFIG_DIR: join(home, '.claude-work') },
  });

  expect(paths.claude).toEqual([join(home, '.claude-work'), join(home, '.claude')]);
});
