import type { JsonObject } from '@utils/jsonUtils';
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

// One file per session, so this covers a long history of them.
export const COPILOT_CACHED_SESSIONS = 2_048;

export const COPILOT_WORKSPACE_DEPTH = 3;

export const COPILOT_CHAT_SESSIONS_DIR = 'chatSessions';

export const COPILOT_REQUESTS_KEY = 'requests';

export const COPILOT_RESPONSE_KEY = 'response';

export const COPILOT_TOOL_NAMES = new Map<string, string>([
  ['copilot_readFile', 'Read'],
  ['copilot_replaceString', 'Edit'],
  ['copilot_multiReplaceString', 'MultiEdit'],
  ['run_in_terminal', 'Bash'],
  ['copilot_findFiles', 'Glob'],
  ['copilot_findTextInFiles', 'Grep'],
  ['copilot_fetchWebPage', 'WebFetch'],
  ['vscode_fetchWebPage_internal', 'WebFetch'],
  ['manage_todo_list', 'TodoWrite'],
]);

export const COPILOT_LINK_PATTERN = /\]\(([^)\s]+)\)/u;

export const COPILOT_INCLUDE_PATTERN = /\(`([^`]*)`\)/u;

export const COPILOT_BACKTICK_PATTERN = /`([^`]*)`/gu;

export const COPILOT_URL_PATTERN = /https?:\/\/[^\s`)\]]+/iu;

export const COPILOT_FILE_URL_PREFIX = 'file://';

export const COPILOT_TRAILING_PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?', ')']);

export const ANTIGRAVITY_BRAIN = 'brain';

export const ANTIGRAVITY_CONVERSATIONS = 'conversations';

export const ANTIGRAVITY_MANIFEST = 'manifest.json';

export const ANTIGRAVITY_TASK = 'task.md';

export const ANTIGRAVITY_UNPLACED = 'unplaced';

/* Read in this order: the first heading found is the session's label. */
export const ANTIGRAVITY_ARTIFACTS = ['task.md', 'implementation_plan.md', 'walkthrough.md'];

/*
 * The tool phrases Antigravity writes into a conversation's protobuf as plain
 * text. The phrase is the handle: the enum around it has no published schema,
 * so there is nothing to decode it against.
 */
export const ANTIGRAVITY_TOOL_PHRASES: readonly (readonly [string, string])[] = [
  ['opening url', 'BrowserOpenUrl'],
  ['getting dom', 'BrowserGetDom'],
  ['getting console logs', 'BrowserGetConsoleLogs'],
  ['clicking', 'BrowserClick'],
  ['taking screenshot', 'BrowserScreenshot'],
  ['scrolling mouse wheel', 'BrowserScrollMouseWheel'],
];

export const ANTIGRAVITY_PRINTABLE_MIN = 32;

export const ANTIGRAVITY_PRINTABLE_MAX = 126;

export const ANTIGRAVITY_SPACE = 32;

export const ANTIGRAVITY_KEPT = new Set([9, 10, 13]);

export const OPENCODE_MESSAGE_LIMIT = 20_000;

export const OPENCODE_PART_LIMIT = 60_000;

export const OPENCODE_EMPTY_PAYLOAD: JsonObject = {};

/*
 * OpenCode's `read` wraps the file body in <path>/<type>/<content> tags, numbers
 * every line, and appends a pager note. The path is already on the call's own
 * row and none of the rest is file content, so all of it is stripped and the
 * card shows the file the way it reads: a markdown file renders, code prints.
 */
export const OPENCODE_READ_ENVELOPE
  = /^<path>[^\n]*<\/path>\n<type>[^\n]*<\/type>\n<content>\n?([\s\S]*?)\n?<\/content>\s*$/u;

export const OPENCODE_LINE_GUTTER = /^\d+:[ \t]?/gmu;

export const OPENCODE_PAGER_NOTE = /\((?:End of file|File has more lines)[^)]*\)\s*$/u;

export const OPENCODE_CANONICAL_TOOLS = new Map<string, string>([
  ['bash', 'Bash'],
  ['write', 'Write'],
  ['edit', 'Edit'],
  ['patch', 'MultiEdit'],
  ['multi-edit', 'MultiEdit'],
  ['multiedit', 'MultiEdit'],
  ['read', 'Read'],
  ['glob', 'Glob'],
  ['grep', 'Grep'],
  ['websearch', 'WebSearch'],
  ['webfetch', 'WebFetch'],
  ['todowrite', 'TodoWrite'],
  ['task', 'Task'],
  ['agent', 'Agent'],
]);

export const CODEX_PATCH_OPEN = '*** Begin Patch';

export const CODEX_PATCH_CLOSE = '*** End Patch';

export const CODEX_FILE_HEADER = /^\*\*\* (?:Add|Update|Delete) File: /u;

export const CODEX_HELPER = /\btools\.([A-Za-z_$][\w$]*)\s*\(/u;

export const CODEX_SHELL_FIELD = /[{,]\s*["']?(?:cmd|command)["']?\s*:\s*/gu;

/**
 * A "key": "value" pair, as it appears in a JSON argument blob or an embedded
 * object literal. Values holding an escaped quote are cut at it, which is fine
 * for a display row.
 */
export const CODEX_JSON_PAIR = /"([A-Za-z_$][\w$]*)"\s*:\s*"([^"]*)"/gu;

export const CODEX_ROW_LIMIT = 300;

export const CODEX_ESCAPES = new Map([
  ['n', '\n'],
  ['t', '\t'],
  ['r', '\r'],
]);

/*
 * Cline drives tools with XML inside the assistant's own text instead of a
 * structured tool_use block, so every call renders as raw markup unless it is
 * read back out. The known names are a list rather than "any tag" because
 * prose and code samples carry angle brackets too, and treating those as calls
 * would eat the transcript around them.
 */
export const CLINE_TOOLS = new Set([
  'access_mcp_resource',
  'ask_followup_question',
  'attempt_completion',
  'browser_action',
  'execute_command',
  'list_code_definition_names',
  'list_files',
  'new_task',
  'plan_mode_respond',
  'read_file',
  'replace_in_file',
  'search_files',
  'use_mcp_tool',
  'web_fetch',
  'write_to_file',
]);

// Cline's name for a tool the shared parser already knows under Claude's name.
export const CLINE_PARSER_NAMES = new Map([
  ['execute_command', 'Bash'],
  ['read_file', 'Read'],
  ['search_files', 'Grep'],
  ['write_to_file', 'Write'],
]);

export const CLINE_PATH_TOOLS = new Set(['read_file', 'replace_in_file', 'write_to_file']);

export const CLINE_TASK_PROGRESS = 'task_progress';

export const CLINE_NAME = /^[a-z_][a-z0-9_]*$/;

export const OPENCODE_PREFIX = 'oc:';
