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

import { resolveBinary, runBinary } from './binaryUtils';

afterEach(() => {
  vi.unstubAllEnvs();
});

// Generous rather than tight: a real subprocess under a loaded test run can take
// far longer than it would alone, and this only caps a hang, not the happy path.
const TIMEOUT_MS = 10_000;

const stubbedBinary = async (name: string, script: string): Promise<string> => {
  const bin = await mkdtemp(join(tmpdir(), 'binary-'));
  const executable = join(bin, name);

  await writeFile(executable, `#!/bin/sh\n${script}\n`);
  await chmod(executable, 0o755);

  return bin;
};

describe('resolveBinary', () => {
  test('finds a binary on PATH and skips empty or unusable entries before it', async () => {
    const bin = await stubbedBinary('tool', 'echo found');
    const missing = join(tmpdir(), 'binary-absent');

    vi.stubEnv('PATH', ['', missing, bin].join(delimiter));

    await expect(resolveBinary('tool')).resolves.toBe(join(bin, 'tool'));
  });

  test('reports nothing when the binary is on no PATH entry', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'binary-empty-'));

    vi.stubEnv('PATH', empty);

    await expect(resolveBinary('tool')).resolves.toBeUndefined();
  });

  test('reports nothing when the environment carries no PATH at all', async () => {
    vi.stubEnv('PATH', undefined);

    await expect(resolveBinary('tool')).resolves.toBeUndefined();
  });
});

describe('runBinary', () => {
  test('resolves the combined output when the process exits cleanly', async () => {
    const bin = await stubbedBinary('tool', 'echo installed');

    await expect(runBinary(join(bin, 'tool'), [], { timeoutMs: TIMEOUT_MS })).resolves.toEqual({
      ok: true,
      output: 'installed',
    });
  });

  test('keeps stdout and stderr together when the process exits non-zero', async () => {
    const bin = await stubbedBinary('tool', 'echo partial\necho boom >&2\nexit 1');

    await expect(runBinary(join(bin, 'tool'), [], { timeoutMs: TIMEOUT_MS })).resolves.toEqual({
      ok: false,
      output: 'partial\nboom',
    });
  });

  test('falls back to the exit status when the process printed nothing', async () => {
    const bin = await stubbedBinary('tool', 'exit 3');

    const result = await runBinary(join(bin, 'tool'), [], { timeoutMs: TIMEOUT_MS });

    expect(result.ok).toBe(false);
    expect(result.output).toContain('Command failed');
  });

  test('runs in the given working directory', async () => {
    const bin = await stubbedBinary('tool', 'pwd');
    const cwd = await mkdtemp(join(tmpdir(), 'binary-cwd-'));

    const result = await runBinary(join(bin, 'tool'), [], {
      cwd,
      timeoutMs: TIMEOUT_MS,
    });

    expect(result.ok).toBe(true);
    // realpath, since macOS's tmpdir is itself a symlink pwd resolves through.
    expect(result.output).toContain(cwd.split('/').at(-1) ?? cwd);
  });
});

describe('runBinary environment', () => {
  test('lays the given variables over the inherited environment', async () => {
    const bin = await stubbedBinary('tool', 'echo "$CLAUDE_CONFIG_DIR"');

    await expect(runBinary(join(bin, 'tool'), [], {
      env: { CLAUDE_CONFIG_DIR: '/home/me/.claude-personal' },
      timeoutMs: TIMEOUT_MS,
    })).resolves.toEqual({
      ok: true,
      output: '/home/me/.claude-personal',
    });
  });
});
