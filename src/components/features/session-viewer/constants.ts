/**
 * How tall each row is before it is measured. One number for every row made the
 * total height wrong by a wide margin on a mixed transcript, and the scrollbar
 * jumped as rows mounted and corrected it, so each kind estimates its own.
 */
export const DATE_ROW_PX = 32;

export const SUMMARY_ROW_PX = 56;

export const SYSTEM_ROW_PX = 72;

export const USER_ROW_PX = 104;

export const ASSISTANT_BASE_PX = 64;

export const ASSISTANT_BLOCK_PX = 120;

export const OVERSCAN = 6;

/*
 * How far below the viewport the next page starts loading. A screen's worth, so
 * the rows are there by the time the reader scrolls onto them and the button
 * below them is never the only way down.
 */
export const LOAD_AHEAD_MARGIN = '800px';

/**
 * An attribute-free lowercase tag name: every framing wrapper the agents emit
 * (<environment_details>, <system-reminder>, <path>/<type>/<content>) and almost
 * no real prose.
 */
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
 * Catalog prose that is the same every session and describes none of it. A
 * carve per tag rather than one regex: a lazy match to a backreferenced close
 * backtracks super-linearly on a long turn.
 */
export const NOISE_BLOCKS = ['apps_instructions', 'plugins_instructions', 'skills_instructions'];

// The working directory and the mode are the two a transcript reader needs. The
// file list, open tabs and context gauge are noise, like the filesystem tree.
export const CLINE_FIELDS: readonly (readonly [string, RegExp])[] = [
  ['cwd', /^# Current Working Directory \(([^)]+)\) Files$/mu],
  ['mode', /^# Current Mode\r?\n(.+)$/mu],
];
