/**
 * Feeds every source file to the banned-pattern checker.
 *
 * The checker takes explicit paths because lint-staged and the editor hook pass
 * the files they touched. Globbing here keeps that contract while leaving
 * `lint:types` a single command, and leaves the generated checker untouched so
 * `lintel sync` can still replace it.
 */
import { execFileSync } from 'node:child_process';
import { globSync } from 'node:fs';
import { execPath } from 'node:process';

const files = globSync('src/**/*.{ts,tsx,astro}');

if (files.length === 0) {
  process.stderr.write('no source files found to check\n');
  process.exit(1);
}

// execPath rather than "node": resolving off PATH would run whatever it finds.
execFileSync(execPath, ['scripts/checkBannedPatterns.ts', ...files], { stdio: 'inherit' });
