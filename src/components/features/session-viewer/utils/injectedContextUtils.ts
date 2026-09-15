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
  // cwd, shell, date and timezone from Codex, or cwd and mode from Cline. The
  // parts a transcript reader does not need are dropped.
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

// An indexOf walk rather than a regex: a lazy match between a tag and its
// backreferenced close is the shape that backtracks super-linearly.
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

/*
 * No raw tag may reach the Markdown renderer, where a hyphen tag renders as an
 * invisible node and an underscore tag prints its brackets. The file envelope
 * is rewritten first, before the generic peel shreds it. Repeats: pairs nest.
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
 * Splits the run of pseudo-XML blocks so each reads as what it is rather than
 * as one wall of tags. Undefined when no marker is present, so every other
 * agent injected context falls through unchanged.
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
