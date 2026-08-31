/**
 * Mints the Ed25519 pair that signs the update manifest.
 *
 * The public half is safe to publish, it ships inside the app so a build can
 * reject a feed it was not given. The private half signs `latest.json` and
 * must never enter the repository; this writes it outside the working tree and
 * prints the one command that loads it into CI.
 *
 * Run once per project. Rotating the key invalidates every build that carries
 * the old public half, so treat it as a release-breaking change.
 */
import { generateKeyPairSync } from 'node:crypto';
import {
  chmod,
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const KEY_DIR = join(homedir(), '.ai-manager');
const KEY_PATH = join(KEY_DIR, 'update-signing-key.pem');

const main = async (): Promise<void> => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');

  // Raw 32 bytes is what WebCrypto importKey('raw', ...) expects on the app side.
  const rawPublic = publicKey.export({
    type: 'spki',
    format: 'der',
  }).subarray(-32);

  const pem = privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  });

  await mkdir(KEY_DIR, { recursive: true });
  await writeFile(KEY_PATH, pem, 'utf8');
  await chmod(KEY_PATH, 0o600);

  const base64Public = rawPublic.toString('base64');

  process.stdout.write([
    '',
    'Private key written to:',
    `  ${KEY_PATH}  (mode 600, outside the repository)`,
    '',
    'Public key (base64, safe to commit and publish):',
    `  ${base64Public}`,
    '',
    'Load the private key into CI, then you never need the file again:',
    `  gh secret set UPDATE_SIGNING_KEY < ${KEY_PATH}`,
    '',
    'Set the public key for local runs:',
    `  export UPDATE_PUBLIC_KEY=${base64Public}`,
    '',
  ].join('\n'));
};

await main();
