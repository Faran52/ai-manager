/**
 * The version lives in three places and the updater compares releases against
 * the one baked into the app. If they drift, a build either never sees itself
 * as outdated or offers an update it already is, and nothing fails loudly.
 *
 *   node scripts/syncVersion.ts           verify all three agree
 *   node scripts/syncVersion.ts 1.2.0     set all three
 */
import { readFile, writeFile } from 'node:fs/promises';

const APP_CONFIG = 'src/config/appConfig.ts';
const VERSION_IN_CONFIG = /(version: ')([^']+)(')/u;

const readJson = async (path: string): Promise<Record<string, string>> => {
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, string>;
};

const configVersion = (source: string): string | undefined => {
  return VERSION_IN_CONFIG.exec(source)?.[2];
};

const main = async (): Promise<void> => {
  const target = process.argv[2];
  const [pkg, deno, config] = await Promise.all([
    readJson('package.json'),
    readJson('deno.json'),
    readFile(APP_CONFIG, 'utf8'),
  ]);

  if (target == null) {
    const found = {
      'package.json': pkg.version,
      'deno.json': deno.version,
      [APP_CONFIG]: configVersion(config),
    };
    const unique = new Set(Object.values(found));

    if (unique.size !== 1) {
      process.stderr.write('version mismatch:\n');

      for (const [file, value] of Object.entries(found)) {
        process.stderr.write(`  ${file}: ${String(value)}\n`);
      }

      process.stderr.write('\nrun: node scripts/syncVersion.ts <version>\n');
      process.exit(1);
    }

    process.stdout.write(`version ${String(pkg.version)} consistent across all three\n`);

    return;
  }

  if (!/^\d+\.\d+\.\d+$/u.test(target)) {
    process.stderr.write(`not a semver version: ${target}\n`);
    process.exit(1);
  }

  await writeFile('package.json', `${JSON.stringify({
    ...pkg,
    version: target,
  }, null, 2)}\n`, 'utf8');
  await writeFile('deno.json', `${JSON.stringify({
    ...deno,
    version: target,
  }, null, 2)}\n`, 'utf8');
  await writeFile(APP_CONFIG, config.replace(VERSION_IN_CONFIG, `$1${target}$3`), 'utf8');

  process.stdout.write(`version set to ${target} in package.json, deno.json and ${APP_CONFIG}\n`);
};

await main();
