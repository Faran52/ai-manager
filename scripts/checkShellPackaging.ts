/**
 * Every module the desktop shell imports has to be listed in electron-builder's
 * `files:`, which is a whitelist nothing else checks. A module left off it
 * builds, lints, types and tests clean, then throws ERR_MODULE_NOT_FOUND at
 * launch, so this walks the imports and compares them against the list.
 *
 * Usage: node scripts/checkShellPackaging.ts
 */
import { readFileSync } from 'node:fs';
import {
  dirname,
  join,
  relative,
} from 'node:path';
import { exit } from 'node:process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const entry = 'scripts/desktopEntry.ts';

/*
 * A relative specifier, the only kind naming a file we ship. Anchored on `from`
 * or a bare side-effect `import`, both of which sit on the specifier's own line
 * even when the braces above them span several.
 */
const RELATIVE_IMPORT = /\b(?:from|import)\s+['"](\.[^'"]+)['"]/gu;

const listedFiles = (): readonly string[] => {
  const lines = readFileSync(join(root, 'electron-builder.yml'), 'utf8').split('\n');
  const start = lines.indexOf('files:');

  if (start < 0) {
    throw new Error('electron-builder.yml names no files to ship');
  }

  const listed: string[] = [];

  // Plain slicing rather than a pattern: the block is a flat list, and a regex
  // spanning its lines backtracks badly enough that sonarjs rejects it.
  for (const line of lines.slice(start + 1)) {
    const item = line.trim();

    if (!item.startsWith('- ')) {
      break;
    }

    listed.push(item.slice(2).trim());
  }

  return listed;
};

/* `dist/**` covers anything under it; every other entry names one file. */
const isListed = (path: string, listed: readonly string[]): boolean => {
  return listed.some((pattern) => {
    return pattern.endsWith('/**')
      ? path.startsWith(pattern.slice(0, -2))
      : pattern === path;
  });
};

/* Imports reachable from the entry, which is what the bundle actually needs. */
const reachable = (from: string, seen = new Set<string>()): ReadonlySet<string> => {
  if (seen.has(from)) {
    return seen;
  }

  seen.add(from);

  const source = readFileSync(join(root, from), 'utf8');

  for (const [, specifier] of source.matchAll(RELATIVE_IMPORT)) {
    if (specifier == null) {
      continue;
    }

    const resolved = relative(root, join(root, dirname(from), specifier));

    // Only what this repo authors: a built artefact is covered by `dist/**`.
    if (resolved.startsWith('scripts/')) {
      reachable(resolved, seen);
    }
    else {
      seen.add(resolved);
    }
  }

  return seen;
};

const listed = listedFiles();
const missing = [...reachable(entry)].filter((path) => {
  return !isListed(path, listed);
});

if (missing.length > 0) {
  console.error(`${entry} imports files electron-builder.yml does not ship:\n`);

  for (const path of missing) {
    console.error(`  ${path}`);
  }

  console.error('\nAdd each to the `files:` list, or the packaged app dies on launch.');
  exit(1);
}

console.log(`shell packaging: ${String(listed.length)} entries cover every import`);
