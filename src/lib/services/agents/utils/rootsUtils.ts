import { readdirSync } from 'node:fs';
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

/**
 * CLAUDE_CONFIG_DIR (or CODEX_HOME) only reaches this process when whatever
 * launched it set the variable, which a shell alias wrapping just the
 * `claude` binary never does: the value lives in that one subprocess's own
 * environment and nowhere this app can read it from, on any OS. A second
 * profile is found by name instead, so nothing needs configuring on any
 * machine and it works whatever the sibling is called, as long as it still
 * starts with the default's own name. Case-insensitive, because NTFS does
 * not distinguish them and a user typing the name by hand would not either.
 */
const siblingRoots = (home: string, defaultName: string): readonly string[] => {
  const needle = defaultName.toLowerCase();

  try {
    return readdirSync(home, { withFileTypes: true })
      .filter((entry) => {
        return entry.isDirectory() && entry.name.toLowerCase().startsWith(needle);
      })
      .map((entry) => {
        return join(home, entry.name);
      })
      .sort((left, right) => {
        return left.localeCompare(right, undefined, { sensitivity: 'base' });
      });
  }
  catch {
    return [];
  }
};

// The default stays first: a rename or delete always targets index 0, so it
// can never be displaced by a sibling found this way.
const withSiblings = (primary: string, home: string, defaultName: string): readonly [string, ...string[]] => {
  return [primary, ...siblingRoots(home, defaultName).filter((root) => {
    return root !== primary;
  })];
};

export const CLAUDE_HOME_NAME = '.claude';
export const CODEX_HOME_NAME = '.codex';

/*
 * The label a badge adds for a root beyond the plain default: ".claude-personal"
 * reads as "Personal", so a project or session found there is not shown as
 * indistinguishable "Claude Code". Undefined for the plain default name itself,
 * and for a root that does not follow the naming convention at all (a custom
 * CLAUDE_CONFIG_DIR with nothing to derive from), so this can be called on
 * every root uniformly rather than only the ones known to be siblings.
 */
export const rootProfileLabel = (root: string, defaultName: string): string | undefined => {
  const name = root.slice(root.lastIndexOf(sep) + 1);
  const needle = defaultName.toLowerCase();

  if (name.toLowerCase() === needle || !name.toLowerCase().startsWith(needle)) {
    return undefined;
  }

  const suffix = name.slice(defaultName.length).replace(/^[-_.\s]+/, '');

  return suffix.length === 0
    ? undefined
    : `${suffix.charAt(0).toUpperCase()}${suffix.slice(1).toLowerCase()}`;
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

/**
 * A packaged desktop app is launched by the OS rather than from a shell, so its
 * working directory is the filesystem root. Scanning from there walks the whole
 * disk, which on macOS means a permission prompt for Desktop, Downloads, every
 * cloud-sync folder and every mounted volume. The working directory is only a
 * plausible project parent when it sits inside the home directory.
 */
const workingRoot = (home: string): readonly string[] => {
  const cwd = process.cwd();

  return cwd.startsWith(`${home}${sep}`) ? [cwd] : [];
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
  const pearai = editorStorage(home, platform, 'PearAI');
  const commonProjects = withoutNested([
    ...workingRoot(home),
    join(home, 'Projects'),
    join(home, 'Developer'),
    join(home, 'src'),
  ]);

  return {
    'aider': commonProjects,
    'amazonq': [join(apps, 'amazon-q', 'data.sqlite3'), join(data, 'amazon-q', 'data.sqlite3')],
    'antigravity': [
      join(home, '.gemini', 'antigravity-cli'),
      join(home, '.gemini', 'antigravity'),
    ],
    'claude': withSiblings(envPath(env, 'CLAUDE_CONFIG_DIR', join(home, CLAUDE_HOME_NAME)), home, CLAUDE_HOME_NAME),
    'cline': [
      join(vscode, 'globalStorage', 'saoudrizwan.claude-dev', 'tasks'),
      join(vscode, 'globalStorage', 'rooveterinaryinc.roo-cline', 'tasks'),
      join(vscode, 'globalStorage', 'kilocode.kilo-code', 'tasks'),
    ],
    'codebuddy': [join(home, '.codebuddy')],
    'codex': withSiblings(envPath(env, 'CODEX_HOME', join(home, CODEX_HOME_NAME)), home, CODEX_HOME_NAME),
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
    // Real config lives at .kimi-code (KIMI_CODE_HOME); .kimi is a different,
    // unrelated product sharing the display name.
    'kimi': [envPath(env, 'KIMI_CODE_HOME', join(home, '.kimi-code'))],
    'kiro': [join(apps, 'kiro-cli', 'data.sqlite3'), join(data, 'kiro-cli', 'data.sqlite3')],
    // click.get_app_dir("io.datasette.llm"): platform app-data, not XDG on
    // every OS (macOS is Library/Application Support, not .local/share).
    'llm': [join(apps, 'io.datasette.llm', 'logs.db')],
    'ompi': [join(home, '.omp', 'agent', 'sessions')],
    'opencode': [join(data, 'opencode'), join(apps, 'ai.opencode.desktop', 'opencode')],
    /**
     * Root, not .../sessions: V0 nests conversations/<id>/events under
     * "sessions", V1 renamed that segment to "conversations". The base dir
     * ($OPENHANDS_PERSISTENCE_DIR, default ~/.openhands) covers either.
     */
    'openhands': [envPath(env, 'OPENHANDS_PERSISTENCE_DIR', join(home, '.openhands'))],
    'openinterpreter': [envPath(env, 'INTERPRETER_HOME', join(home, '.openinterpreter'))],
    /**
     * PearAI is a VS Code fork (dataFolderName ".pearai", confirmed from its
     * own product.json) whose AI chat is a Continue fork, so its real data is
     * most likely VS Code's own globalStorage layout, not a CLI-style
     * dotfile; kept alongside the original guess since neither is confirmed
     * against a real install.
     */
    'pearai': [join(home, '.pearai', 'sessions'), join(pearai, 'globalStorage')],
    'pi': [join(home, '.pi', 'agent', 'sessions')],
    'qwen': [envPath(env, 'QWEN_CODE_HOME', join(home, '.qwen', 'projects'))],
    'trae': [join(apps, 'Trae', 'User', 'workspaceStorage'), join(config, 'Trae', 'User', 'workspaceStorage')],
    /**
     * logs/session was the config doc's example for a project-local override
     * (a ./.vibe under a project directory), not the global default; the
     * global default session_logging.save_dir is plain <VIBE_HOME>/sessions.
     */
    'vibe': [join(envPath(env, 'VIBE_HOME', join(home, '.vibe')), 'sessions')],
    'zed': [join(apps, 'Zed', 'threads', 'threads.db'), join(data, 'zed', 'threads', 'threads.db')],
  };
};
