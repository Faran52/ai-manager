import {
  chmod,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';

import { runClaudeCli } from './claudeCliUtils';

afterEach(() => {
  vi.unstubAllEnvs();
});

const stubbedClaude = async (script: string): Promise<string> => {
  const bin = await mkdtemp(join(tmpdir(), 'claude-bin-'));
  const executable = join(bin, 'claude');

  await writeFile(executable, `#!/bin/sh\n${script}\n`);
  await chmod(executable, 0o755);

  return bin;
};

describe('runClaudeCli', () => {
  test('resolves the combined output when the cli exits cleanly', async () => {
    const bin = await stubbedClaude('echo installed');

    vi.stubEnv('PATH', bin);

    await expect(runClaudeCli(['plugin', 'list'], { cwd: bin })).resolves.toEqual({
      ok: true,
      output: 'installed',
    });
  });

  test('keeps stdout and stderr together when the cli exits non-zero', async () => {
    const bin = await stubbedClaude('echo partial\necho boom >&2\nexit 1');

    vi.stubEnv('PATH', bin);

    await expect(runClaudeCli(['plugin', 'enable', 'x'], { cwd: bin })).resolves.toEqual({
      ok: false,
      output: 'partial\nboom',
    });
  });

  test('falls back to the exit status when the cli printed nothing', async () => {
    const bin = await stubbedClaude('exit 3');

    vi.stubEnv('PATH', bin);

    const result = await runClaudeCli(['plugin', 'list'], { cwd: bin });

    expect(result.ok).toBe(false);
    expect(result.output).toContain('Command failed');
  });

  test('skips empty and unusable path entries before the executable one', async () => {
    const bin = await stubbedClaude('echo found');
    const missing = join(tmpdir(), 'claude-absent');

    vi.stubEnv('PATH', ['', missing, bin].join(delimiter));

    await expect(runClaudeCli(['plugin', 'list'], { cwd: bin })).resolves.toEqual({
      ok: true,
      output: 'found',
    });
  });

  test('reports a missing cli rather than spawning from the working directory', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'claude-empty-'));

    vi.stubEnv('PATH', empty);

    await expect(runClaudeCli(['plugin', 'list'], { cwd: empty })).resolves.toEqual({
      ok: false,
      output: 'The claude CLI was not found on PATH.',
    });
  });

  test('reports a missing cli when the environment carries no PATH at all', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'claude-nopath-'));

    vi.stubEnv('PATH', undefined);

    await expect(runClaudeCli(['plugin', 'list'], { cwd: empty })).resolves.toEqual({
      ok: false,
      output: 'The claude CLI was not found on PATH.',
    });
  });
});
