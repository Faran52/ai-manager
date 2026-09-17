// Row heights the virtualizer starts from. rowEstimateUtils.ts explains them.
export const DATE_ROW_PX = 32;

export const SUMMARY_ROW_PX = 56;

export const SYSTEM_ROW_PX = 72;

// Everything a turn draws around its prose: the speaker line, and the padding.
export const USER_ROW_PX = 56;

export const ASSISTANT_BASE_PX = 40;

// A block whose height owes nothing to text: redacted thinking, and a tool call
// summarised to its one-line header.
export const ASSISTANT_BLOCK_PX = 48;

export const TOOL_USE_BLOCK_PX = 72;

export const PROSE_CHARS_PER_LINE = 90;

export const PROSE_LINE_PX = 22;

export const OVERSCAN = 6;

/*
 * How far below the viewport the next page starts loading. A screen's worth, so
 * the rows are there by the time the reader scrolls onto them.
 */
export const LOAD_AHEAD_MARGIN = '800px';

// An attribute-free lowercase tag name: every framing wrapper the agents emit
// (<environment_details>, <system-reminder>, <path>/<type>) and almost no prose.
export const WRAPPER_NAME = /^[a-z][a-z\d_-]*$/u;

// A line that is nothing but one such tag: an unclosed opener, or a stray closer.
export const LONE_WRAPPER = /^[ \t]*<\/?[a-z][\w-]*>[ \t]*\r?\n?/gmu;

// The line an instruction payload is filed under, redundant once the body is
// rendered under its own label.
export const HEADER = /^(?:# (?:AGENTS|CLAUDE)\.md instructions for |Base directory for this skill: ).*(?:\r?\n)?/u;

// A "- Name (id@source)" bullet. `\S.*` after the spaces keeps this linear: the
// leading whitespace is chewed to the first non-space and the rest is the name.
export const PLUGIN_LINE = /^ *- +(\S.*)/gmu;

export const ENV_FIELDS: readonly (readonly [string, string])[] = [
  ['cwd', 'cwd'],
  ['shell', 'shell'],
  ['date', 'current_date'],
  ['timezone', 'timezone'],
];

/*
 * Catalog prose that is the same every session. A carve per tag rather than one
 * regex: a lazy match to a backreferenced close backtracks super-linearly.
 */
export const NOISE_BLOCKS = ['apps_instructions', 'plugins_instructions', 'skills_instructions'];

// The working directory and the mode are the two a transcript reader needs. The
// file list, open tabs and context gauge are noise, like the filesystem tree.
export const CLINE_FIELDS: readonly (readonly [string, RegExp])[] = [
  ['cwd', /^# Current Working Directory \(([^)]+)\) Files$/mu],
  ['mode', /^# Current Mode\r?\n(.+)$/mu],
];
