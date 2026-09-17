import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

export interface BinaryRunResult {
  readonly ok: boolean;
  readonly output: string;
}

export interface BinaryRunOptions {
  readonly cwd?: string;
  // Laid over the inherited environment, for a CLI steered by a variable.
  readonly env?: Readonly<Record<string, string>> | undefined;
  readonly timeoutMs: number;
}

/*
 * A binary lands wherever its installer put it. Walking PATH keeps the spawned path
 * absolute, which an empty PATH entry would make relative to the working directory.
 */
export const resolveBinary = async (name: string): Promise<string | undefined> => {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (directory.length === 0) {
      continue;
    }

    const candidate = join(directory, name);

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
export const runBinary = (
  binary: string,
  args: readonly string[],
  options: BinaryRunOptions,
): Promise<BinaryRunResult> => {
  return new Promise((resolve) => {
    execFile(binary, [...args], {
      cwd: options.cwd,
      env: options.env == null
        ? undefined
        : {
            ...process.env,
            ...options.env,
          },
      timeout: options.timeoutMs,
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
