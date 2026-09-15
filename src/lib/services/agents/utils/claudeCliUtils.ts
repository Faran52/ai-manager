import { resolveBinary, runBinary } from './binaryUtils';

import type { BinaryRunResult } from './binaryUtils';

export type ClaudeCliResult = BinaryRunResult;

export interface ClaudeCliOptions {
  readonly cwd: string;
  // A sibling profile's config dir; Claude Code reads CLAUDE_CONFIG_DIR for it.
  readonly claudeDir?: string | undefined;
}

export type ClaudeCliRunner = (args: readonly string[], options: ClaudeCliOptions) => Promise<ClaudeCliResult>;

// Installs can fetch and build a plugin, so the ceiling is generous.
const TIMEOUT_MS = 180_000;

export const runClaudeCli = async (
  args: readonly string[],
  options: ClaudeCliOptions,
): Promise<ClaudeCliResult> => {
  const binary = await resolveBinary('claude');

  if (binary == null) {
    return {
      ok: false,
      output: 'The claude CLI was not found on PATH.',
    };
  }

  return runBinary(binary, args, {
    cwd: options.cwd,
    env: options.claudeDir == null ? undefined : { CLAUDE_CONFIG_DIR: options.claudeDir },
    timeoutMs: TIMEOUT_MS,
  });
};
