import { createHash } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  describe,
  expect,
  test,
} from 'vitest';

import { readFileHistory, readVersionDiff } from './fileHistoryService';

const SESSION = 'session-1';
const TRACKED = '/repo/src/app.ts';

const snapshotDir = (home: string): string => {
  return join(home, '.claude', 'file-history', SESSION);
};

const newHome = async (): Promise<string> => {
  const home = await mkdtemp(join(tmpdir(), 'file-history-'));

  await mkdir(snapshotDir(home), { recursive: true });

  return home;
};

const writeSnapshot = async (
  home: string,
  version: number,
  content: string,
  path = TRACKED,
): Promise<void> => {
  const key = createHash('sha256').update(path).digest('hex').slice(0, 16);

  await writeFile(join(snapshotDir(home), `${key}@v${String(version)}`), content, 'utf8');
};

describe('readFileHistory', () => {
  test('lists the versions kept for one file, oldest first', async () => {
    const home = await newHome();

    await writeSnapshot(home, 2, 'second');
    await writeSnapshot(home, 1, 'first');
    await writeSnapshot(home, 1, 'other file', '/repo/src/other.ts');

    const history = await readFileHistory(SESSION, TRACKED, home);

    expect(history.path).toBe(TRACKED);
    expect(history.versions.map((entry) => {
      return entry.version;
    })).toEqual([1, 2]);
    expect(history.versions[0]?.sizeBytes).toBe(5);
    expect(history.versions[0]?.savedMs).toBeGreaterThan(0);
  });

  test('reports nothing for a session that kept no snapshots', async () => {
    const home = await mkdtemp(join(tmpdir(), 'file-history-'));

    expect(await readFileHistory(SESSION, TRACKED, home)).toEqual({
      path: TRACKED,
      versions: [],
    });
  });

  test('ignores names that are not versions of a tracked file', async () => {
    const home = await newHome();
    const key = createHash('sha256').update(TRACKED).digest('hex').slice(0, 16);

    await writeSnapshot(home, 1, 'kept');
    await writeFile(join(snapshotDir(home), `${key}@vzero`), 'nope', 'utf8');
    await writeFile(join(snapshotDir(home), `${key}@v0`), 'nope', 'utf8');
    await writeFile(join(snapshotDir(home), 'stray-file'), 'nope', 'utf8');

    const history = await readFileHistory(SESSION, TRACKED, home);

    expect(history.versions.map((entry) => {
      return entry.version;
    })).toEqual([1]);
  });

  test('ignores a version that points at nothing', async () => {
    const home = await newHome();
    const key = createHash('sha256').update(TRACKED).digest('hex').slice(0, 16);

    await writeSnapshot(home, 1, 'kept');
    await symlink(join(snapshotDir(home), 'absent'), join(snapshotDir(home), `${key}@v2`));

    const history = await readFileHistory(SESSION, TRACKED, home);

    expect(history.versions.map((entry) => {
      return entry.version;
    })).toEqual([1]);
  });

  test('skips a snapshot it is not allowed to look at', async () => {
    const home = await newHome();
    const locked = join(snapshotDir(home), 'locked');

    await writeSnapshot(home, 1, 'kept');
    await mkdir(locked);
    await chmod(snapshotDir(home), 0o500);

    const history = await readFileHistory(SESSION, TRACKED, home);

    await chmod(snapshotDir(home), 0o700);

    expect(history.versions).toHaveLength(1);
  });
});

describe('readVersionDiff', () => {
  test('compares a version against the one before it', async () => {
    const home = await newHome();

    await writeSnapshot(home, 1, 'a\nb\nc');
    await writeSnapshot(home, 2, 'a\nB\nc');

    const diff = await readVersionDiff(SESSION, TRACKED, 2, home);

    expect(diff?.version).toBe(2);
    expect(diff?.firstRecorded).toBe(false);
    expect(diff?.hunks[0]?.lines).toEqual([
      ' a',
      '-b',
      '+B',
      ' c',
    ]);
  });

  test('says so when nothing was kept from before the oldest change', async () => {
    const home = await newHome();

    await writeSnapshot(home, 1, 'only\nversion');

    const diff = await readVersionDiff(SESSION, TRACKED, 1, home);

    expect(diff?.firstRecorded).toBe(true);
    expect(diff?.hunks[0]?.lines).toEqual([
      '-',
      '+only',
      '+version',
    ]);
  });

  test('reports nothing for a version that was never kept', async () => {
    const home = await newHome();

    await writeSnapshot(home, 1, 'only');

    expect(await readVersionDiff(SESSION, TRACKED, 4, home)).toBeUndefined();
  });
});
