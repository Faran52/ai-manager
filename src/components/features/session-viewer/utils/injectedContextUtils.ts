import type { ToolInputRow } from '@services/history/historyService';

export interface ParsedInjectedContext {
  // The AGENTS.md body Codex wraps in <INSTRUCTIONS>, kept as markdown.
  readonly instructions?: string | undefined;
  /**
   * cwd, shell, date and timezone from <environment_context>. The <filesystem>
   * permission tree that block also carries is dropped: it is long and says
   * nothing a reader of the transcript needs.
   */
  readonly environment?: readonly ToolInputRow[] | undefined;
  // Display names from <recommended_plugins>, without the trailing `(id@source)`.
  readonly plugins?: readonly string[] | undefined;
  // Anything not recognised, shown verbatim so nothing is silently lost.
  readonly rest?: string | undefined;
}

interface Carved {
  readonly inner: string;
  readonly rest: string;
}

/**
 * An attribute-free lowercase tag name: every framing wrapper the agents emit
 * (<environment_details>, <system-reminder>, <path>/<type>/<content>) and almost
 * no real prose.
 */
const WRAPPER_NAME = /^[a-z][a-z\d_-]*$/u;
// A line that is nothing but one such tag: an unclosed opener, or a stray closer.
const LONE_WRAPPER = /^[ \t]*<\/?[a-z][\w-]*>[ \t]*\r?\n?/gmu;

/*
 * One sweep that replaces every <tag>...</tag> pair with its trimmed body. An
 * indexOf walk, the way carve() and the Cline reader read tags, because a lazy
 * `[\s\S]*?` between a tag and its backreferenced close is the shape that
 * backtracks super-linearly.
 */
const unwrapOnce = (text: string): string => {
  let result = '';
  let cursor = 0;

  for (let open = text.indexOf('<', cursor); open !== -1; open = text.indexOf('<', cursor)) {
    const nameEnd = text.indexOf('>', open);
    const name = nameEnd === -1 ? '' : text.slice(open + 1, nameEnd);
    const close = WRAPPER_NAME.test(name) ? text.indexOf(`</${name}>`, nameEnd) : -1;

    if (close === -1) {
      result += text.slice(cursor, open + 1);
      cursor = open + 1;
      continue;
    }

    result += text.slice(cursor, open) + text.slice(nameEnd + 1, close).trim();
    cursor = close + name.length + 3;
  }

  return result + text.slice(cursor);
};

/**
 * Peel every framing wrapper off a blob of injected context so no raw tag
 * reaches the Markdown renderer, where a hyphen tag renders as an invisible
 * node and an underscore tag prints its angle brackets. Repeats because one
 * pair can hide another (a <system-reminder> around more markup); injected
 * context never nests deeper than a couple.
 */
export const stripEnvelopes = (text: string): string => {
  let current = text;

  for (let pass = 0; pass < 3; pass += 1) {
    const next = unwrapOnce(current);

    if (next === current) {
      break;
    }

    current = next;
  }

  return current.replace(LONE_WRAPPER, '').replace(/\n{3,}/gu, '\n\n').trim();
};

/**
 * The line an instruction payload is filed under, at the very start of the
 * block: the "# AGENTS.md/CLAUDE.md instructions for <path>" an agent prints
 * above its rules, or the "Base directory for this skill: <path>" Claude Code
 * prints above a skill's SKILL.md. Redundant once the body is rendered under
 * its own label.
 */
const HEADER = /^(?:# (?:AGENTS|CLAUDE)\.md instructions for |Base directory for this skill: ).*(?:\r?\n)?/u;
// A "- Name (id@source)" bullet. `\S.*` after the spaces keeps this linear: the
// leading whitespace is chewed to the first non-space and the rest is the name.
const PLUGIN_LINE = /^ *- +(\S.*)/gmu;

const ENV_FIELDS: readonly (readonly [string, string])[] = [
  ['cwd', 'cwd'],
  ['shell', 'shell'],
  ['date', 'current_date'],
  ['timezone', 'timezone'],
];

// The text between the first `open`/`close` pair, and the source with that
// span removed. Absent or unclosed leaves the source untouched.
const carve = (source: string, open: string, close: string): Carved => {
  const start = source.indexOf(open);
  const end = start < 0 ? -1 : source.indexOf(close, start + open.length);

  if (end < 0) {
    return {
      inner: '',
      rest: source,
    };
  }

  return {
    inner: source.slice(start + open.length, end),
    rest: source.slice(0, start) + source.slice(end + close.length),
  };
};

const fieldValue = (block: string, tag: string): string => {
  const open = `<${tag}>`;
  const start = block.indexOf(open);
  const end = start < 0 ? -1 : block.indexOf(`</${tag}>`, start + open.length);

  return end < 0 ? '' : block.slice(start + open.length, end).trim();
};

const environmentRows = (block: string): readonly ToolInputRow[] => {
  return ENV_FIELDS.flatMap(([label, tag]) => {
    const value = fieldValue(block, tag);

    return value.length > 0
      ? [{
          label,
          value,
        }]
      : [];
  });
};

// "Airtable (airtable@openai-curated-remote)" -> "Airtable". The id in the
// trailing parenthesis is noise once the name is on its own line.
const pluginName = (line: string): string => {
  const name = line.trim();
  const paren = name.lastIndexOf(' (');

  return paren > 0 && name.endsWith(')') ? name.slice(0, paren) : name;
};

const pluginNames = (block: string): readonly string[] => {
  return [...block.matchAll(PLUGIN_LINE)].map((match) => {
    /* v8 ignore next -- PLUGIN_LINE always captures group 1 when it matches */
    return pluginName(match[1] ?? '');
  });
};

/*
 * Injected context arrives as a run of pseudo-XML blocks and header lines: an
 * instruction body (Codex's <INSTRUCTIONS>, or a Claude skill's SKILL.md under
 * its "Base directory" line), an <environment_context>, a <recommended_plugins>
 * list. Split them so each reads as what it is, rather than as one wall of
 * tags. Returns undefined when none of the markers are present, so every other
 * agent's injected context falls through unchanged.
 */
export const parseInjectedContext = (text: string): ParsedInjectedContext | undefined => {
  const env = carve(text, '<environment_context>', '</environment_context>');
  const plugin = carve(env.rest, '<recommended_plugins>', '</recommended_plugins>');
  const wrapped = carve(plugin.rest, '<INSTRUCTIONS>', '</INSTRUCTIONS>');

  const environment = environmentRows(env.inner);
  const plugins = pluginNames(plugin.inner);
  // With no <INSTRUCTIONS> wrapper the body is whatever follows a header line at
  // the very start; the header itself is then just a label the section replaces.
  let instructions = wrapped.inner.trim();
  let rest = wrapped.rest.replace(HEADER, '').trim();

  if (instructions.length === 0 && HEADER.test(wrapped.rest)) {
    instructions = rest;
    rest = '';
  }

  if (instructions.length === 0 && environment.length === 0 && plugins.length === 0) {
    return undefined;
  }

  return {
    ...(instructions.length === 0 ? {} : { instructions }),
    ...(environment.length === 0 ? {} : { environment }),
    ...(plugins.length === 0 ? {} : { plugins }),
    ...(rest.length === 0 ? {} : { rest }),
  };
};
