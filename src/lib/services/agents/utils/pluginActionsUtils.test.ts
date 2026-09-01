import {
  chmod,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import {
  pluginActionArgs,
  pluginActionCwd,
  runPluginAction,
} from './pluginActionsUtils';

import type { PluginActionRequest } from './pluginActionsUtils';

afterEach(() => {
  vi.unstubAllEnvs();
});

const stubbedClaude = async (): Promise<string> => {
  const bin = await mkdtemp(join(tmpdir(), 'claude-bin-'));
  const script = join(bin, 'claude');

  await writeFile(script, '#!/bin/sh\necho stub\n');
  await chmod(script, 0o755);
  vi.stubEnv('PATH', bin);

  return bin;
};

const request = (overrides: Partial<PluginActionRequest>): PluginActionRequest => {
  return {
    action: 'enable',
    plugin: 'code-review@claude-plugins-official',
    scope: 'user',
    projectPath: '/projects/demo',
    ...overrides,
  };
};

const runner = (ok = true) => {
  return vi.fn(() => {
    return Promise.resolve({
      ok,
      output: ok ? 'done' : 'refused',
    });
  });
};

describe('pluginActionArgs', () => {
  test('installs with the scope and the non-interactive yes flag', () => {
    expect(pluginActionArgs(request({ action: 'install' }))).toEqual([
      'plugin',
      'install',
      'code-review@claude-plugins-official',
      '-s',
      'user',
      '-y',
    ]);
  });

  test('enables and disables without the yes flag', () => {
    expect(pluginActionArgs(request({ action: 'enable' }))).toEqual([
      'plugin',
      'enable',
      'code-review@claude-plugins-official',
      '-s',
      'user',
    ]);
    expect(pluginActionArgs(request({ action: 'disable' }))).toEqual([
      'plugin',
      'disable',
      'code-review@claude-plugins-official',
      '-s',
      'user',
    ]);
  });
});

describe('pluginActionCwd', () => {
  test('runs project-scoped actions from the project', () => {
    expect(pluginActionCwd(request({ scope: 'project' }))).toBe('/projects/demo');
  });

  test('runs user-scoped actions from home', () => {
    expect(pluginActionCwd(request({
      scope: 'user',
      home: '/home/x',
    }))).toBe('/home/x');
    expect(pluginActionCwd(request({ scope: 'user' }))).toBe(homedir());
  });
});

describe('runPluginAction', () => {
  test('delegates the composed command to the runner', async () => {
    const run = runner();

    await runPluginAction(request({
      action: 'install',
      scope: 'project',
    }), run);

    expect(run).toHaveBeenCalledWith([
      'plugin',
      'install',
      'code-review@claude-plugins-official',
      '-s',
      'project',
      '-y',
    ], { cwd: '/projects/demo' });
  });

  test('surfaces a refused action to the caller', async () => {
    const run = runner(false);

    await expect(runPluginAction(request({ action: 'disable' }), run)).resolves.toEqual({
      ok: false,
      output: 'refused',
    });
  });

  test('runs the real claude binary through PATH by default', async () => {
    await stubbedClaude();

    await expect(runPluginAction(request({ action: 'enable' }))).resolves.toEqual({
      ok: true,
      output: 'stub',
    });
  });
});
