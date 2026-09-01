import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

export interface ClaudeCliResult {
  readonly ok: boolean;
  readonly output: string;
}

export interface ClaudeCliOptions {
  readonly cwd: string;
}

export type ClaudeCliRunner = (args: readonly string[], options: ClaudeCliOptions) => Promise<ClaudeCliResult>;

// Installs can fetch and build a plugin, so the ceiling is generous.
const TIMEOUT_MS = 180_000;

/**
 * The CLI lands wherever its installer put it (npm global, Homebrew,
 * ~/.local/bin), so the directory cannot be hardcoded. Walking PATH here keeps
 * the spawned path absolute, which an empty PATH entry would otherwise make
 * relative to the working directory.
 */
const resolveClaude = async (): Promise<string | undefined> => {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (directory.length === 0) {
      continue;
    }

    const candidate = join(directory, 'claude');

    try {
      await access(candidate, constants.X_OK);

      return candidate;
    }
    catch {
      continue;
    }
  }

  return undefined;
};

/*
 * execFile hands stdout and stderr to the callback whether or not it failed,
 * so both halves read the same fields and only the exit status branches.
 */
const spawnClaude = (
  binary: string,
  args: readonly string[],
  cwd: string,
): Promise<ClaudeCliResult> => {
  return new Promise((resolve) => {
    execFile(binary, [...args], {
      cwd,
      timeout: TIMEOUT_MS,
      encoding: 'utf8',
    }, (error, stdout, stderr) => {
      const output = `${stdout}${stderr}`.trim();

      if (error == null) {
        resolve({
          ok: true,
          output,
        });
        return;
      }

      resolve({
        ok: false,
        output: output.length > 0 ? output : error.message,
      });
    });
  });
};

export const runClaudeCli = async (
  args: readonly string[],
  options: ClaudeCliOptions,
): Promise<ClaudeCliResult> => {
  const binary = await resolveClaude();

  if (binary == null) {
    return {
      ok: false,
      output: 'The claude CLI was not found on PATH.',
    };
  }

  return spawnClaude(binary, args, options.cwd);
};
