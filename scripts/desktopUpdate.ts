/**
 * Installing an update on a bundle that carries no Developer ID.
 *
 * electron-updater hands the install to Squirrel.Mac, which refuses a
 * replacement that does not satisfy the running app's signing requirement. An
 * unsigned build never will, and ad-hoc signing does not help: that requirement
 * is the bundle's own hash. So the swap is done here, keeping the one guarantee
 * that survives, the sha512 the release publishes.
 *
 * A bundle this process unpacks also carries no `com.apple.quarantine`, so
 * clearing it once covers every build after.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  mkdtemp,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface UpdateFile {
  // Relative to the release, which is how electron-builder writes it.
  readonly url: string;
  readonly sha512: string;
}

export interface Feed {
  readonly owner: string;
  readonly repo: string;
}

export interface InstallOptions {
  readonly files: readonly UpdateFile[];
  readonly version: string;
  readonly arm64: boolean;
  // The running bundle, which is what the download replaces.
  readonly bundlePath: string;
  // Where the shell reads the feed the build was packed against.
  readonly resourcesPath: string;
  readonly pid: number;
  readonly onProgress?: ((fraction: number) => void)
    | undefined;
}

// Read rather than restated, so the feed stays whatever the build config said.
export const parseFeed = (yml: string): Feed => {
  const read = (key: string): string => {
    const line = new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'mu').exec(yml);

    if (line?.[1] == null) {
      throw new Error(`the update feed names no ${key}`);
    }

    return line[1];
  };

  return {
    owner: read('owner'),
    repo: read('repo'),
  };
};

/*
 * An arm64 Mac takes the arm64 build, or the universal one where there is none.
 * The rule electron-updater uses, by the same tell: the arch is in the name.
 */
export const pickZip = (files: readonly UpdateFile[], arm64: boolean): UpdateFile | undefined => {
  const zips = files.filter((file) => {
    return file.url.endsWith('.zip');
  });
  const named = (file: UpdateFile): boolean => {
    return file.url.includes('arm64');
  };

  if (arm64 && zips.some(named)) {
    return zips.find(named);
  }

  return zips.find((file) => {
    return !named(file);
  });
};

// Where a GitHub release keeps its artifacts. The tag is the version, prefixed.
export const releaseUrl = (feed: Feed, version: string, file: string): string => {
  const tag = encodeURIComponent(`v${version}`);

  return `https://github.com/${feed.owner}/${feed.repo}/releases/download/${tag}/${encodeURIComponent(file)}`;
};

// Base64, because that is the encoding electron-builder writes into the feed.
export const sha512Base64 = async (path: string): Promise<string> => {
  const hash = createHash('sha512');

  await pipeline(createReadStream(path), hash);

  return hash.digest('base64');
};

/*
 * A script rather than work in process, because the bundle being replaced is
 * the one this process runs from. The old one is moved aside, not deleted, so a
 * failed move in puts it back.
 */
const swapScript = `
set -e
waited=0
while kill -0 "$1" 2>/dev/null; do
  sleep 0.2
  waited=$((waited + 1))
  [ "$waited" -gt 300 ] && exit 1
done
aside="$2.replaced"
rm -rf "$aside"
mv "$2" "$aside"
if mv "$3" "$2"; then
  rm -rf "$aside"
else
  mv "$aside" "$2"
fi
rm -rf "$(dirname "$3")"
/usr/bin/open "$2"
`;

const download = async (
  url: string,
  destination: string,
  onProgress?: (fraction: number) => void,
): Promise<void> => {
  const response = await fetch(url);

  if (!response.ok || response.body == null) {
    throw new Error(`the update download answered ${String(response.status)}`);
  }

  // `fetch` answers with the DOM's ReadableStream, `fromWeb` wants node's.
  const body = response.body as Parameters<typeof Readable.fromWeb>[0];
  const total = Number(response.headers.get('content-length') ?? 0);
  let taken = 0;

  // A release with no content-length reports nothing rather than a wrong figure.
  const count = new Transform({
    transform: (chunk: Buffer, _encoding, next) => {
      taken += chunk.length;

      if (total > 0) {
        onProgress?.(taken / total);
      }

      next(null, chunk);
    },
  });

  await pipeline(Readable.fromWeb(body), count, createWriteStream(destination));
};

const unpack = async (zip: string, into: string): Promise<string> => {
  await new Promise<void>((resolve, reject) => {
    // ditto, not unzip: a bundle's symlinks and permissions have to survive.
    const extract = spawn('/usr/bin/ditto', ['-x', '-k', zip, into], { stdio: 'ignore' });

    extract.on('error', reject);
    extract.on('exit', (code) => {
      if (code === 0) {
        resolve();

        return;
      }

      reject(new Error(`unpacking the update exited ${String(code)}`));
    });
  });

  const unpacked = (await readdir(into)).find((entry) => {
    return entry.endsWith('.app');
  });

  if (unpacked == null) {
    throw new Error('the update holds no application bundle');
  }

  return join(into, unpacked);
};

// Returns once the swap script is running. The caller quits; the script does the rest.
export const installUpdate = async (options: InstallOptions): Promise<void> => {
  const feed = parseFeed(await readFile(join(options.resourcesPath, 'app-update.yml'), 'utf8'));
  const file = pickZip(options.files, options.arm64);

  if (file == null) {
    throw new Error('the release carries no archive this machine can install');
  }

  // Staged beside the bundle: the swap is a rename, so it cannot cross volumes.
  const staging = await mkdtemp(`${options.bundlePath}.update-`);
  const zip = join(staging, 'update.zip');

  await download(releaseUrl(feed, options.version, file.url), zip, options.onProgress);

  const digest = await sha512Base64(zip);

  if (digest !== file.sha512) {
    throw new Error('the update did not match the checksum the release published');
  }

  const staged = await unpack(zip, staging);
  const script = join(await mkdtemp(join(tmpdir(), 'ai-manager-swap-')), 'swap.sh');

  await writeFile(script, swapScript, 'utf8');

  const swap = spawn('/bin/sh', [
    script,
    String(options.pid),
    options.bundlePath,
    staged,
  ], {
    detached: true,
    stdio: 'ignore',
  });

  swap.unref();
};
