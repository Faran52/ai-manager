// Byte-level markers the Claude Code JSONL format is scanned with.
export const TIMESTAMP_PREFIX = '"timestamp":"';
export const SUMMARY_MARKER = '"type":"summary"';
export const TITLE_MARKER = '"customTitle"';
export const USER_MARKER = '"type":"user"';
export const ASSISTANT_MARKER = '"type":"assistant"';
export const SIDECHAIN_MARKER = '"isSidechain":true';
export const CWD_PREFIX = '"cwd":"';
export const BRANCH_PREFIX = '"gitBranch":"';
// The leading quote keeps this off `"parentUuid":"` and `"leafUuid":"`.
export const UUID_PREFIX = '"uuid":"';
export const JSONL_SUFFIX = '.jsonl';

/**
 * Agents that keep history inside the projects themselves force a walk of
 * ordinary source trees. Dependency and build directories cannot hold agent
 * history, and they hold the overwhelming majority of the files, so pruning
 * them is the difference between a scan that takes a second and one that does
 * not.
 */
export const SKIPPED_SCAN_DIRS: ReadonlySet<string> = new Set([
  '.astro',
  '.cache',
  '.git',
  '.gradle',
  '.next',
  '.nuxt',
  '.pnpm',
  '.svelte-kit',
  '.terraform',
  '.tox',
  '.turbo',
  '.venv',
  '__pycache__',
  'bower_components',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'Pods',
  'target',
  'venv',
  'vendor',
]);
