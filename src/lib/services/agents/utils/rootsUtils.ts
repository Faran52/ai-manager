import { homedir } from 'node:os';
import { join, sep } from 'node:path';

import type { AgentId } from '@config/agents';

export type AgentPathMap = Readonly<Record<AgentId, readonly string[]>> & {
  readonly claude: readonly [string, ...string[]];
  readonly codex: readonly [string, ...string[]];
};

export interface RootResolutionOptions {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly home?: string | undefined;
  readonly platform?: NodeJS.Platform | undefined;
}

/**
 * Agents that keep history inside projects are pointed at several likely
 * parents, and the working directory is often one of those parents' children.
 * Scanning both would walk the same tree twice for no new results, so a root
 * that sits inside another is dropped.
 */
const withoutNested = (roots: readonly string[]): readonly string[] => {
  const outermost = [...new Set(roots)].sort((left, right) => {
    return left.length - right.length;
  });

  return outermost.filter((root, index) => {
    return !outermost.slice(0, index).some((earlier) => {
      return root.startsWith(`${earlier}${sep}`);
    });
  });
};

const envPath = (
  env: Readonly<Record<string, string | undefined>>,
  key: string,
  fallback: string,
): string => {
  const value = env[key];

  return value != null && value.length > 0 ? value : fallback;
};

const editorStorage = (home: string, platform: NodeJS.Platform, editor: string): string => {
  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', editor, 'User');
  }

  if (platform === 'win32') {
    return join(home, 'AppData', 'Roaming', editor, 'User');
  }

  return join(home, '.config', editor, 'User');
};

const appData = (home: string, platform: NodeJS.Platform): string => {
  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support');
  }

  return platform === 'win32'
    ? join(home, 'AppData', 'Roaming')
    : join(home, '.local', 'share');
};

export const resolveAgentPaths = ({
  env,
  home = homedir(),
  platform = process.platform,
}: RootResolutionOptions): AgentPathMap => {
  const data = envPath(env, 'XDG_DATA_HOME', join(home, '.local', 'share'));
  const config = envPath(env, 'XDG_CONFIG_HOME', join(home, '.config'));
  const apps = appData(home, platform);
  const vscode = editorStorage(home, platform, 'Code');
  const cursor = editorStorage(home, platform, 'Cursor');
  const commonProjects = withoutNested([
    process.cwd(),
    join(home, 'Projects'),
    join(home, 'Developer'),
    join(home, 'src'),
  ]);

  return {
    'aider': commonProjects,
    'amazonq': [join(apps, 'amazon-q', 'data.sqlite3'), join(data, 'amazon-q', 'data.sqlite3')],
    'antigravity': [join(home, '.gemini', 'antigravity-cli')],
    'claude': [envPath(env, 'CLAUDE_CONFIG_DIR', join(home, '.claude'))],
    'cline': [
      join(vscode, 'globalStorage', 'saoudrizwan.claude-dev', 'tasks'),
      join(vscode, 'globalStorage', 'rooveterinaryinc.roo-cline', 'tasks'),
      join(vscode, 'globalStorage', 'kilocode.kilo-code', 'tasks'),
    ],
    'codebuddy': [join(home, '.codebuddy')],
    'codex': [envPath(env, 'CODEX_HOME', join(home, '.codex'))],
    'continue': [envPath(env, 'CONTINUE_GLOBAL_DIR', join(home, '.continue', 'sessions'))],
    'copilot': [join(vscode, 'workspaceStorage')],
    'crush': commonProjects,
    'cursor': [
      join(cursor, 'globalStorage', 'state.vscdb'),
      join(cursor, 'workspaceStorage'),
      join(home, '.cursor'),
    ],
    'cursor-agent': [join(home, '.cursor', 'projects')],
    'forgecode': [join(home, '.forge', '.forge.db')],
    'gemini': [join(envPath(env, 'GEMINI_CLI_HOME', join(home, '.gemini')), 'tmp')],
    'goose': [join(data, 'goose', 'sessions', 'sessions.db')],
    'grok': [join(home, '.grok', 'sessions')],
    'kimi': [join(home, '.kimi')],
    'kiro': [join(apps, 'kiro-cli', 'data.sqlite3'), join(data, 'kiro-cli', 'data.sqlite3')],
    'llm': [join(data, 'io.datasette.llm', 'logs.db')],
    'ompi': [join(home, '.omp', 'agent', 'sessions')],
    'opencode': [join(data, 'opencode'), join(apps, 'ai.opencode.desktop', 'opencode')],
    'openhands': [join(home, '.openhands', 'sessions')],
    'openinterpreter': [envPath(env, 'INTERPRETER_HOME', join(home, '.openinterpreter'))],
    'pearai': [join(home, '.pearai', 'sessions')],
    'pi': [join(home, '.pi', 'agent', 'sessions')],
    'qwen': [envPath(env, 'QWEN_CODE_HOME', join(home, '.qwen', 'projects'))],
    'trae': [join(apps, 'Trae', 'User', 'workspaceStorage'), join(config, 'Trae', 'User', 'workspaceStorage')],
    'vibe': [envPath(env, 'VIBE_HOME', join(home, '.vibe')), join(home, '.vibe', 'logs', 'session')],
    'zed': [join(apps, 'Zed', 'threads', 'threads.db'), join(data, 'zed', 'threads', 'threads.db')],
  };
};
