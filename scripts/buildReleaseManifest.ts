/**
 * Builds the `latest.json` the updater reads.
 *
 * Every artifact is hashed, and when a signing key is present the document is
 * wrapped in an Ed25519 envelope. The app refuses an unsigned feed once it has
 * been given a public key, so an unsigned manifest is only useful for a build
 * that carries no key at all.
 *
 * Usage:
 *   node scripts/buildReleaseManifest.ts <version> <artifact...>
 *
 * Platform is inferred from each artifact's extension, which is what the app
 * looks up when it decides whether a release applies to the machine it is on.
 */
import { createHash, sign } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

interface Artifact {
  readonly name: string;
  readonly sha256: string;
}

const PLATFORM_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.zip': 'darwin',
  '.dmg': 'darwin',
  '.msi': 'windows',
  '.appimage': 'linux',
};

const platformOf = (file: string): string | undefined => {
  return PLATFORM_BY_EXTENSION[extname(file).toLowerCase()];
};

const artifactOf = async (file: string): Promise<Artifact> => {
  const bytes = await readFile(file);

  return {
    name: basename(file),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
};

// Ed25519 signs the message itself, so Node wants the one-shot form with a null
// digest. The streaming createSign API rejects the key outright.
const signDocument = (document: string, pem: string): string => {
  return sign(null, Buffer.from(document, 'utf8'), pem).toString('base64');
};

const main = async (): Promise<void> => {
  const [version, ...files] = process.argv.slice(2);

  if (version == null || files.length === 0) {
    process.stderr.write('usage: buildReleaseManifest.ts <version> <artifact...>\n');
    process.exit(1);
  }

  const artifacts: Record<string, Artifact> = {};

  for (const file of files) {
    const platform = platformOf(file);

    if (platform == null) {
      process.stderr.write(`skipping ${file}, no platform for its extension\n`);
      continue;
    }

    artifacts[platform] = await artifactOf(file);
  }

  if (Object.keys(artifacts).length === 0) {
    process.stderr.write('no recognised artifacts, refusing to write an empty manifest\n');
    process.exit(1);
  }

  const document = JSON.stringify({
    version,
    artifacts,
  });

  const keyPem = process.env.UPDATE_SIGNING_KEY;
  const manifest = keyPem == null || keyPem.length === 0
    ? document
    : JSON.stringify({
        signed: document,
        signature: signDocument(document, keyPem),
      });

  await writeFile('latest.json', `${manifest}\n`, 'utf8');

  const signedNote = keyPem == null || keyPem.length === 0
    ? 'UNSIGNED (set UPDATE_SIGNING_KEY to sign)'
    : 'signed';

  process.stdout.write(`latest.json written for ${version}, ${signedNote}\n`);
  process.stdout.write(`platforms: ${Object.keys(artifacts).join(', ')}\n`);
};

await main();
