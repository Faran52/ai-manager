import { unwrapFileRefs } from '@utils/markdownUtils';

import {
  CLINE_FIELDS,
  ENV_FIELDS,
  HEADER,
  LONE_WRAPPER,
  NOISE_BLOCKS,
  PLUGIN_LINE,
  WRAPPER_NAME,
} from '../constants';

import type { ToolInputRow } from '@services/history/historyService';

export interface ParsedInjectedContext {
  // The AGENTS.md body Codex wraps in <INSTRUCTIONS>, kept as markdown.
  readonly instructions?: string | undefined;
  /**
   * cwd, shell, date and timezone from Codex's <environment_context>, or cwd and
   * mode from Cline's <environment_details>. The parts of either block that a
   * transcript reader does not need (the <filesystem> permission tree, the file
   * list, the open tabs) are dropped.
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
 * node and an underscore tag prints its angle brackets. An attached-file
 * envelope is rewritten to its path and body first, before the generic peel
 * shreds it into a stray path, the word "file" and a wall of content. Repeats
 * because one pair can hide another (a <system-reminder> around more markup);
 * injected context never nests deeper than a couple.
 */
export const stripEnvelopes = (text: string): string => {
  let current = unwrapFileRefs(text);

  for (let pass = 0; pass < 3; pass += 1) {
    const next = unwrapOnce(current);

    if (next === current) {
      break;
    }

    current = next;
  }

  return current.replace(LONE_WRAPPER, '').replace(/\n{3,}/gu, '\n\n').trim();
};

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

const dropNoise = (source: string): string => {
  return NOISE_BLOCKS.reduce((acc, tag) => {
    return carve(acc, `<${tag}>`, `</${tag}>`).rest;
  }, source);
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

const clineEnvironmentRows = (block: string): readonly ToolInputRow[] => {
  return CLINE_FIELDS.flatMap(([label, pattern]) => {
    const match = pattern.exec(block);

    if (match === null) {
      return [];
    }

    /* v8 ignore next -- every CLINE_FIELDS pattern has a mandatory capture group */
    const value = (match[1] ?? '').trim();

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
 * its "Base directory" line), an <environment_context> or Cline's
 * <environment_details>, a <recommended_plugins> list. Split them so each reads
 * as what it is, rather than as one wall of tags. Returns undefined when none of
 * the markers are present, so every other agent's injected context falls
 * through unchanged.
 */
export const parseInjectedContext = (text: string): ParsedInjectedContext | undefined => {
  const env = carve(text, '<environment_context>', '</environment_context>');
  const details = carve(env.rest, '<environment_details>', '</environment_details>');
  const plugin = carve(details.rest, '<recommended_plugins>', '</recommended_plugins>');
  const wrapped = carve(plugin.rest, '<INSTRUCTIONS>', '</INSTRUCTIONS>');

  const environment = [
    ...environmentRows(env.inner),
    ...clineEnvironmentRows(details.inner),
  ];
  const plugins = pluginNames(plugin.inner);
  const remainder = dropNoise(wrapped.rest);
  // With no <INSTRUCTIONS> wrapper the body is whatever follows a header line at
  // the very start; the header itself is then just a label the section replaces.
  let instructions = wrapped.inner.trim();
  let rest = remainder.replace(HEADER, '').trim();

  if (instructions.length === 0 && HEADER.test(remainder)) {
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
