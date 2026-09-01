import { homedir } from 'node:os';

import { runClaudeCli } from './claudeCliUtils';

import type { ClaudeCliResult, ClaudeCliRunner } from './claudeCliUtils';
import type { SetupScope } from './setupUtils';

export type PluginActionName = 'install' | 'enable' | 'disable';

export interface PluginActionRequest {
  readonly action: PluginActionName;
  readonly plugin: string;
  readonly scope: SetupScope;
  readonly projectPath: string;
  readonly home?: string | undefined;
}

const BASE_ARGS: Record<PluginActionName, readonly string[]> = {
  disable: ['plugin', 'disable'],
  enable: ['plugin', 'enable'],
  install: ['plugin', 'install'],
};

/*
 * The registry files belong to the CLI, so every mutation goes through it.
 * -y is mandatory here: the desktop shell is never a TTY, and an install that
 * would prompt for a marketplace command must fail loudly instead of hanging.
 */
export const pluginActionArgs = (request: PluginActionRequest): readonly string[] => {
  const base = [...BASE_ARGS[request.action], request.plugin, '-s', request.scope];

  return request.action === 'install' ? [...base, '-y'] : base;
};

// A project-scoped action resolves the project from the working directory.
export const pluginActionCwd = (request: PluginActionRequest): string => {
  if (request.scope === 'project') {
    return request.projectPath;
  }

  return request.home ?? homedir();
};

export const runPluginAction = (
  request: PluginActionRequest,
  run: ClaudeCliRunner = runClaudeCli,
): Promise<ClaudeCliResult> => {
  return run(pluginActionArgs(request), { cwd: pluginActionCwd(request) });
};
