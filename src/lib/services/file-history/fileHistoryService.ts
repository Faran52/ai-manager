import { createHash } from 'node:crypto';
import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { diffLines } from './utils/diffUtils';

import type { PatchHunk } from '../history/types';

export interface FileVersion {
  readonly version: number;
  readonly savedMs: number;
  readonly sizeBytes: number;
}

export interface FileHistory {
  readonly path: string;
  readonly versions: readonly FileVersion[];
}

export interface FileVersionDiff {
  readonly version: number;
  readonly hunks: readonly PatchHunk[];
  // The oldest snapshot has nothing before it: Claude Code stores the file as
  // it stood after each change, never as it stood before the first one.
  readonly firstRecorded: boolean;
}

// Claude Code names each snapshot after the file it came from, so the path has
// to be hashed the same way to find them again.
const SNAPSHOT_NAME_LENGTH = 16;

const snapshotKey = (path: string): string => {
  return createHash('sha256').update(path).digest('hex').slice(0, SNAPSHOT_NAME_LENGTH);
};

const sessionDir = (sessionId: string, home: string): string => {
  return join(home, '.claude', 'file-history', sessionId);
};

const versionOf = (name: string, key: string): number | undefined => {
  const marker = `${key}@v`;

  if (!name.startsWith(marker)) {
    return undefined;
  }

  const version = Number(name.slice(marker.length));

  return Number.isInteger(version) && version > 0 ? version : undefined;
};

const snapshotPath = (
  sessionId: string,
  path: string,
  version: number,
  home: string,
): string => {
  return join(sessionDir(sessionId, home), `${snapshotKey(path)}@v${String(version)}`);
};

export const readFileHistory = async (
  sessionId: string,
  path: string,
  home: string = homedir(),
): Promise<FileHistory> => {
  const key = snapshotKey(path);
  let names: readonly string[] = [];

  try {
    names = await readdir(sessionDir(sessionId, home));
  }
  catch {
    return {
      path,
      versions: [],
    };
  }

  const versions = await Promise.all(names.map(async (name) => {
    const version = versionOf(name, key);

    if (version == null) {
      return [];
    }

    try {
      const info = await stat(join(sessionDir(sessionId, home), name));

      return [{
        version,
        savedMs: info.mtimeMs,
        sizeBytes: info.size,
      }];
    }
    catch {
      return [];
    }
  }));

  return {
    path,
    versions: versions.flat().sort((left, right) => {
      return left.version - right.version;
    }),
  };
};

const contentOf = async (
  sessionId: string,
  path: string,
  version: number,
  home: string,
): Promise<string | undefined> => {
  try {
    return await readFile(snapshotPath(sessionId, path, version, home), 'utf8');
  }
  catch {
    return undefined;
  }
};

export const readVersionDiff = async (
  sessionId: string,
  path: string,
  version: number,
  home: string = homedir(),
): Promise<FileVersionDiff | undefined> => {
  const after = await contentOf(sessionId, path, version, home);

  if (after == null) {
    return undefined;
  }

  const before = await contentOf(sessionId, path, version - 1, home);

  return {
    version,
    hunks: before == null ? diffLines('', after) : diffLines(before, after),
    firstRecorded: before == null,
  };
};
