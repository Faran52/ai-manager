import {
  chmod,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import {
  AGENT_INSTALLS,
  checkAgentInstalled,
  installableAgents,
  installCommandText,
  runAgentInstall,
} from './installUtils';

afterEach(() => {
  vi.unstubAllEnvs();
});

const stubbedBinary = async (name: string, script: string): Promise<string> => {
  const bin = await mkdtemp(join(tmpdir(), 'install-'));
  const executable = join(bin, name);

  await writeFile(executable, `#!/bin/sh\n${script}\n`);
  await chmod(executable, 0o755);

  return bin;
};

test('lists exactly the agents with a verified install command', () => {
  expect(installableAgents).toEqual(Object.keys(AGENT_INSTALLS));
  expect(installableAgents).toContain('codebuddy');
  // Named collisions, GUI-only installers, and auth-gated setup: never guessed.
  expect(installableAgents).not.toContain('kimi');
  expect(installableAgents).not.toContain('forgecode');
  expect(installableAgents).not.toContain('pearai');
  expect(installableAgents).not.toContain('trae');
  expect(installableAgents).not.toContain('kiro');
  expect(installableAgents).not.toContain('ompi');
});

describe('installCommandText', () => {
  test('names the exact command a reader is asked to approve', () => {
    expect(installCommandText('codebuddy')).toBe('npm install -g @tencent-ai/codebuddy-code');
  });

  test('is undefined for an agent with no verified install command', () => {
    expect(installCommandText('kimi')).toBeUndefined();
  });
});

describe('checkAgentInstalled', () => {
  test('is false for an agent with no verified install command', async () => {
    await expect(checkAgentInstalled('kimi')).resolves.toBe(false);
  });

  test('is true once the check binary is on PATH', async () => {
    const bin = await stubbedBinary('crush', 'exit 0');

    vi.stubEnv('PATH', bin);

    await expect(checkAgentInstalled('crush')).resolves.toBe(true);
  });

  test('is false while the check binary is not on PATH', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'install-empty-'));

    vi.stubEnv('PATH', empty);

    await expect(checkAgentInstalled('crush')).resolves.toBe(false);
  });
});

describe('runAgentInstall', () => {
  test('reports no command for an agent with none', async () => {
    await expect(runAgentInstall('kimi')).resolves.toEqual({
      ok: false,
      output: 'No verified install command for kimi.',
    });
  });

  test('runs the exact command an entry names', async () => {
    const run = vi.fn(() => {
      return Promise.resolve({
        ok: true,
        output: 'installed',
      });
    });

    await expect(runAgentInstall('codebuddy', run)).resolves.toEqual({
      ok: true,
      output: 'installed',
    });
    expect(run).toHaveBeenCalledWith('npm', ['install', '-g', '@tencent-ai/codebuddy-code']);
  });

  test('reports the package manager missing rather than spawning blind', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'install-empty-'));

    vi.stubEnv('PATH', empty);

    await expect(runAgentInstall('crush')).resolves.toEqual({
      ok: false,
      output: 'npm was not found on PATH.',
    });
  });

  test('runs the real install command once its binary resolves', async () => {
    const bin = await stubbedBinary('npm', 'echo done');

    vi.stubEnv('PATH', bin);

    await expect(runAgentInstall('codebuddy')).resolves.toEqual({
      ok: true,
      output: 'done',
    });
  });
});
