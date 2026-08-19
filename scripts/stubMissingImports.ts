/**
 * Astro's server bundle keeps JSDoc `import('./x.js')` references to sibling
 * modules that were tree-shaken away. Node ignores those comments, but Deno
 * resolves every specifier while building its module graph, so each dangling
 * one becomes a hard error during `deno desktop`.
 *
 * This pass walks the built server output and materialises an empty stub for
 * every missing relative `.js` target, making the bundle resolution-clean for
 * both runtimes.
 */
import {
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
  resolve,
} from 'node:path';

const DIST_SERVER = resolve('dist/server');

const SPECIFIER = /(?:from\s*|import\s*\(\s*)['"](\.\.?\/[^'"]+\.js)['"]/g;

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    }
    else if (entry.name.endsWith('.mjs') || entry.name.endsWith('.js')) {
      files.push(full);
    }
  }

  return files;
};

const created: string[] = [];

for (const file of await walk(DIST_SERVER)) {
  const source = await readFile(file, 'utf8');
  const dir = dirname(file);

  for (const match of source.matchAll(SPECIFIER)) {
    const specifier = match[1];

    if (specifier == null) {
      continue;
    }

    const target = resolve(dir, specifier);

    try {
      await stat(target);
    }
    catch {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, '// Type-only module referenced by bundled JSDoc.\nexport {};\n');
      created.push(target);
    }
  }
}

if (created.length > 0) {
  console.log(`[stubMissingImports] created ${String(created.length)} stub(s)`);

  for (const target of created) {
    console.log(`  ${target}`);
  }
}
