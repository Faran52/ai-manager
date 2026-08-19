/**
 * Mechanical floor for the type standards, run by lint-staged and the PostToolUse(Edit|Write) hook.
 * `sync` restores it when missing but never overwrites your lists.
 *
 * Usage: node scripts/checkBannedPatterns.ts src/foo.ts src/bar.tsx src/App.vue
 */
import { readFileSync } from 'node:fs';
import { argv, exit } from 'node:process';

interface BannedPattern {
  name: string;
  re: RegExp;
  // Matched with string literals blanked and comments kept: a directive lives inside a comment.
  inComments?: boolean;
  allowed?: RegExp[];
}

type TypeSafety = 'strict' | 'relaxed';

// Only these `: unknown` forms are allowed.
const NARROWING_GUARD = /:\s*unknown\b[^)]*\)\s*:\s*\w+\s+is\s/;
const PARSED_JSON = /:\s*unknown\s*=\s*JSON\.parse\(/;
const DYNAMIC_IMPORT = /:\s*unknown\s*=\s*await import\(/;

/**
 * A thrown value, which `catch` binds as `unknown` by language rule under `useUnknownInCatchVariables`. Matched on
 * the whole parameter list rather than on `: unknown` anywhere in it, and on the three conventional names for a
 * caught value, so it grants a single-argument helper turning a throw into something readable and nothing else.
 *
 * Structural evidence is not available here: TypeScript has no distinct type for a caught value, so the line carries
 * no shape a regex could key on instead of the name.
 */
const CAUGHT_VALUE = /\(\s*(?:error|cause|reason)\s*:\s*unknown\s*\)/;

/**
 * The same value reached through a promise: `.catch(cb)` binds exactly what a `catch` clause would, so the callback's
 * one parameter is a caught value whatever it is named. Structural rather than a name list, which is why it grants
 * `err` and every other spelling the name grant above cannot enumerate.
 */
const CAUGHT_IN_CHAIN = /\.catch\(\s*(?:async\s*)?\(\s*\w+\s*:\s*unknown\s*\)/;

// Anchor directives to comments so ordinary prose can name them, and match them with strings blanked, so the same
// words inside a string literal stay fixture text rather than an instruction.
const directive = (name: string): RegExp => {
  return new RegExp(`(?://|/\\*)\\s*${name}`);
};

// Which floor this project runs. `@linteljs/create` writes this line from the `typeSafety` answer.
const TYPE_SAFETY: TypeSafety = 'strict';

const ALWAYS_BANNED: BannedPattern[] = [
  {
    name: 'as unknown as',
    re: /\bas unknown as\b/,
  },
  {
    name: 'eslint-disable',
    re: directive('eslint-disable'),
    inComments: true,
  },
];

const STRICT_ONLY: BannedPattern[] = [
  {
    name: 'as never',
    re: /\bas never\b/,
  },
  {
    name: 'as unknown',
    re: /\bas unknown\b/,
  },
  {
    name: ': unknown',
    re: /:\s*unknown\b/,
    allowed: [NARROWING_GUARD, PARSED_JSON, DYNAMIC_IMPORT, CAUGHT_VALUE, CAUGHT_IN_CHAIN],
  },
  {
    name: '=> unknown',
    re: /=>\s*unknown\b/,
  },
  {
    name: 'unknown[]',
    re: /unknown\[]/,
  },
  {
    name: '<unknown>',
    re: /<unknown[,>]/,
  },
  {
    name: '@ts-ignore',
    re: directive('@ts-ignore'),
    inComments: true,
  },
  {
    name: '@ts-expect-error',
    re: directive('@ts-expect-error'),
    inComments: true,
  },
  {
    name: 'Record<string, unknown>',
    re: /Record<string,\s*unknown>/,
  },
  {
    name: 'index signature',
    re: /\[[A-Za-z_]\w*:\s*(?:string|number|symbol)]/,
  },
];

// Lookup preserves the relaxed branch for coverage.
const FLOORS: Record<TypeSafety, BannedPattern[]> = {
  strict: [...ALWAYS_BANNED, ...STRICT_ONLY],
  relaxed: ALWAYS_BANNED,
};

const BANNED: BannedPattern[] = FLOORS[TYPE_SAFETY];

const PROJECT_BANNED: BannedPattern[] = [];

const BASE_SKIPPED = ['/scripts/'];

const PROJECT_SKIPPED: string[] = [];

const patterns: BannedPattern[] = [...BANNED, ...PROJECT_BANNED];
const skipped: string[] = [...BASE_SKIPPED, ...PROJECT_SKIPPED];

const isSkipped = (filePath: string): boolean => {
  return skipped.some((fragment) => {
    return filePath.includes(fragment) || filePath.startsWith(fragment.replace(/^\//, ''));
  });
};

// Ignore import and alias `as`, which are not assertions.
const isAliasOrImportLine = (line: string): boolean => {
  return line.includes('* as ')
    || /^\s*import\b/.test(line)
    || /^\s*export\s+(?:type\s+)?\{/.test(line)
    || /^\s*(?:type\s+)?[A-Za-z_]\w*\s+as\s+[A-Za-z_]\w*,?\s*$/.test(line);
};

// Preserve offsets so reported lines remain correct.
const blankSpan = (match: string): string => {
  return match.replace(/[^\n]/g, ' ');
};

// Strip comments before templates so unmatched prose backticks cannot span the file.
const blankMultilineSpans = (content: string): string => {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, blankSpan)
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, blankSpan);
};

/**
 * Strings blanked, comments kept, which is what a directive pattern is matched against. Stripping comments would hide
 * every directive there is, and matching the untouched line reported the same words inside a string literal, where
 * they are a test fixture rather than an instruction to any tool.
 */
const stripStrings = (line: string): string => {
  return line
    .replace(/\\['"]/g, '  ')
    .replace(/'[^']*'|"[^"]*"/g, blankSpan);
};

const stripStringsAndComments = (line: string): string => {
  return stripStrings(line).replace(/\/\/.*/, '');
};

const SCRIPT_FILE = /\.[cm]?tsx?$/;
const SFC_FILE = /\.(?:vue|svelte)$/;
const SFC_SCRIPT_BLOCK = /(<script\b[^>]*>)([\s\S]*?)<\/script>/gi;

// Keep only SFC script blocks, blanking the rest to preserve line numbers.
const scriptBlocksOnly = (content: string): string => {
  let output = '';
  let cursor = 0;

  for (const match of content.matchAll(SFC_SCRIPT_BLOCK)) {
    const [, open = '', body = ''] = match;

    output += blankSpan(content.slice(cursor, match.index)) + blankSpan(open) + body;
    cursor = match.index + open.length + body.length;
  }

  return output + blankSpan(content.slice(cursor));
};

const files: string[] = argv.slice(2);
let failed = false;

for (const file of files) {
  const sfc = SFC_FILE.test(file);

  if (!(sfc || SCRIPT_FILE.test(file)) || isSkipped(file)) {
    continue;
  }

  let content = '';

  try {
    content = readFileSync(file, 'utf8');
  }
  catch {
    continue;
  }

  const hits: string[] = [];
  // Same line count, so `source[index]` is the scannable half of the line reported as `line`.
  const source = blankMultilineSpans(sfc ? scriptBlocksOnly(content) : content).split('\n');

  for (const [index, line] of content.split('\n').entries()) {
    // `continue`, not `return`: this skips one line, which is what the callback's `return` meant before the loop was
    // a loop rather than a `forEach`.
    if (isAliasOrImportLine(line)) {
      continue;
    }

    const scrubbed = stripStringsAndComments(source[index] ?? '');

    const match = patterns.find((pattern) => {
      const subject = pattern.inComments === true ? stripStrings(source[index] ?? '') : scrubbed;

      return pattern.re.test(subject) && !pattern.allowed?.some((shape) => {
        return shape.test(subject);
      });
    });

    if (match) {
      hits.push(`${String(index + 1)}: ${line.trim()}  [${match.name}]`);
    }
  }

  if (hits.length > 0) {
    console.error(`✘ Banned pattern in ${file}:`);

    for (const hit of hits) {
      console.error(`  ${hit}`);
    }

    failed = true;
  }
}

if (failed) {
  console.error('\n→ Fix the source: build the real type, from its owner.');
  console.error('  See .claude/rules/type-standards.md.');
  exit(1);
}

exit(0);
