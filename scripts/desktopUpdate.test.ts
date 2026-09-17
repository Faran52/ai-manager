/*
 * The parts that decide something. The download and the swap are a network call
 * and a detached shell; which file is picked and whether the checksum rejects a
 * bad one are not.
 */
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from 'vitest';

import {
  parseFeed,
  pickZip,
  releaseUrl,
  sha512Base64,
} from './desktopUpdate.ts';

const files = [
  {
    url: 'AI Manager-0.3.0-arm64-mac.zip',
    sha512: 'arm',
  },
  {
    url: 'AI Manager-0.3.0-mac.zip',
    sha512: 'intel',
  },
  {
    url: 'AI Manager-0.3.0.dmg',
    sha512: 'dmg',
  },
];

test('reads the feed the build was packed against', () => {
  expect(parseFeed('owner: Faran52\nrepo: ai-manager\nprovider: github\n')).toStrictEqual({
    owner: 'Faran52',
    repo: 'ai-manager',
  });
});

test('refuses a feed that names no repository rather than guessing one', () => {
  expect(() => {
    return parseFeed('owner: Faran52\n');
  }).toThrow('names no repo');
});

test('takes the arm64 archive on an arm64 machine and the other one elsewhere', () => {
  expect(pickZip(files, true)?.sha512).toBe('arm');
  expect(pickZip(files, false)?.sha512).toBe('intel');
});

test('falls back to the universal archive where the release has no arm64 one', () => {
  const universal = [{
    url: 'AI Manager-0.3.0-mac.zip',
    sha512: 'universal',
  }];

  expect(pickZip(universal, true)?.sha512).toBe('universal');
});

test('never offers the dmg, which is not a thing the swap can unpack', () => {
  const dmgOnly = [{
    url: 'AI Manager-0.3.0.dmg',
    sha512: 'dmg',
  }];

  expect(pickZip(dmgOnly, true)).toBeUndefined();
});

test('builds the release URL from the tag, escaping the spaces in the name', () => {
  const feed = {
    owner: 'Faran52',
    repo: 'ai-manager',
  };

  expect(releaseUrl(feed, '0.3.0', 'AI Manager-0.3.0-arm64-mac.zip')).toBe(
    'https://github.com/Faran52/ai-manager/releases/download/v0.3.0/AI%20Manager-0.3.0-arm64-mac.zip',
  );
});

test('digests a file the way the feed records it, and differs when a byte does', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ai-manager-digest-'));
  const path = join(directory, 'update.zip');
  const other = join(directory, 'tampered.zip');

  await writeFile(path, 'the release');
  await writeFile(other, 'the release.');

  expect(await sha512Base64(path)).toBe(createHash('sha512').update('the release').digest('base64'));
  expect(await sha512Base64(other)).not.toBe(await sha512Base64(path));
});
