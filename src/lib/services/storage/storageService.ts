import {
  lstat,
  readdir,
  rm,
  stat,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import {
  basename,
  dirname,
  join,
} from 'node:path';

import { sum, sumBy } from 'es-toolkit';

import { agentOption, agentOptions } from '@config/agents';

import { resolveAgentPaths } from '../agents/agentsService';

import type { AgentId } from '@config/agents';
import type { RootResolutionOptions } from '../agents/agentsService';

export interface StorageEntry {
  readonly name: string;
  readonly path: string;
  readonly bytes: number;
  // True for work an agent can rebuild by itself, so removing it loses nothing.
  readonly reclaimable: boolean;
}

export interface AgentStorage {
  readonly agent: AgentId;
  readonly label: string;
  readonly bytes: number;
  /*
   * The largest things inside, plus everything rebuildable however small. Anything
   * offered for removal has to appear here, or the offer overstates what it frees.
   */
  readonly entries: readonly StorageEntry[];
  readonly reclaimableBytes: number;
}

export interface ReclaimResult {
  readonly removed: readonly string[];
  readonly freedBytes: number;
  readonly refused: readonly string[];
}

export interface StorageReport {
  readonly agents: readonly AgentStorage[];
  readonly totalBytes: number;
  readonly reclaimableBytes: number;
  // True when a walk stopped at its limit, so the totals read as at least rather than exactly.
  readonly partial: boolean;
}

interface Budget {
  remaining: number;
}

interface RootMeasurement {
  readonly bytes: number;
  readonly reclaimableBytes: number;
  readonly entries: readonly StorageEntry[];
}

/*
 * Walking every file would block the request for seconds and the answer only has to
 * point at what is large. Depth stops deep trees, the budget stops one huge directory.
 */
const MAX_DEPTH = 6;
const MAX_ENTRIES = 40_000;
const TOP_ENTRIES = 6;

const notableFirst = (entries: readonly StorageEntry[]): readonly StorageEntry[] => {
  const largest = [...entries].sort((left, right) => {
    return right.bytes - left.bytes;
  });
  const kept = largest.slice(0, TOP_ENTRIES);
  const shown = new Set(kept.map((entry) => {
    return entry.path;
  }));

  return [...kept, ...largest.filter((entry) => {
    return entry.reclaimable && !shown.has(entry.path);
  })];
};

const sizeOf = async (path: string, depth: number, budget: Budget): Promise<number> => {
  if (budget.remaining <= 0) {
    return 0;
  }

  budget.remaining -= 1;

  let facts;

  try {
    facts = await lstat(path);
  }
  catch {
    return 0;
  }

  /*
   * A link holds nothing. Codex leaves directories of links to its own binary, and
   * following them reported four gigabytes that do not exist.
   */
  if (facts.isSymbolicLink()) {
    return 0;
  }

  if (!facts.isDirectory()) {
    return facts.size;
  }

  if (depth >= MAX_DEPTH) {
    return 0;
  }

  let names: readonly string[];

  try {
    names = await readdir(path);
  }
  catch {
    return 0;
  }

  const sizes = await Promise.all(names.map(async (name) => {
    return sizeOf(join(path, name), depth + 1, budget);
  }));

  return sum(sizes);
};

// One walk per root, not two: the children are sized individually and the total is
// their sum.
const measureRoot = async (root: string, budget: Budget): Promise<RootMeasurement> => {
  let facts;

  try {
    facts = await stat(root);
  }
  catch {
    return {
      bytes: 0,
      reclaimableBytes: 0,
      entries: [],
    };
  }

  if (!facts.isDirectory()) {
    return {
      bytes: facts.size,
      reclaimableBytes: 0,
      entries: [],
    };
  }

  let names: readonly string[];

  try {
    names = await readdir(root);
  }
  catch {
    return {
      bytes: 0,
      reclaimableBytes: 0,
      entries: [],
    };
  }

  const measured = await Promise.all(names.map(async (name) => {
    const path = join(root, name);

    return {
      name,
      path,
      bytes: await sizeOf(path, 1, budget),
      reclaimable: isReclaimable(name),
    };
  }));

  return {
    bytes: sumBy(measured, (entry) => {
      return entry.bytes;
    }),
    reclaimableBytes: sumBy(measured, (entry) => {
      return entry.reclaimable ? entry.bytes : 0;
    }),
    entries: notableFirst(measured.filter((entry) => {
      return entry.bytes > 0;
    })),
  };
};

/*
 * Only work an agent rebuilds on demand. Transcripts and generated images are
 * never offered however large: the archive and retention policy own history.
 */
const DISPOSABLE_STEMS: ReadonlySet<string> = new Set([
  'cache',
  'caches',
  'crashes',
  'log',
  'logs',
  'temp',
  'tmp',
]);

const stemOf = (name: string): string => {
  const base = basename(name).toLowerCase();
  const dot = base.indexOf('.');

  return dot <= 0 ? base : base.slice(0, dot);
};

const isReclaimable = (name: string): boolean => {
  const stem = stemOf(name);

  return DISPOSABLE_STEMS.has(stem) || stem.startsWith('log_') || stem.startsWith('logs_');
};

// Some agents keep history inside the projects themselves, so sizing these
// roots would report the user code and node_modules as agent storage.
const projectRoots = (home: string): ReadonlySet<string> => {
  return new Set([
    process.cwd(),
    join(home, 'Projects'),
    join(home, 'Developer'),
    join(home, 'src'),
  ]);
};

export const readStorageReport = async (
  options: RootResolutionOptions,
  maxEntries = MAX_ENTRIES,
): Promise<StorageReport> => {
  const roots = resolveAgentPaths(options);
  const shared = projectRoots(options.home ?? homedir());
  const budget: Budget = { remaining: maxEntries };
  const agents: AgentStorage[] = [];

  for (const option of agentOptions) {
    const seen = new Set<string>();
    let bytes = 0;
    let reclaimableBytes = 0;
    let entries: readonly StorageEntry[] = [];

    for (const root of roots[option.id]) {
      if (seen.has(root) || shared.has(root)) {
        continue;
      }

      seen.add(root);

      const measured = await measureRoot(root, budget);

      if (measured.bytes === 0) {
        continue;
      }

      bytes += measured.bytes;
      reclaimableBytes += measured.reclaimableBytes;
      entries = [...entries, ...measured.entries];
    }

    if (bytes > 0) {
      agents.push({
        agent: option.id,
        label: agentOption(option.id).label,
        bytes,
        reclaimableBytes,
        entries: notableFirst(entries),
      });
    }
  }

  agents.sort((left, right) => {
    return right.bytes - left.bytes;
  });

  return {
    agents,
    totalBytes: sumBy(agents, (agent) => {
      return agent.bytes;
    }),
    reclaimableBytes: sumBy(agents, (agent) => {
      return agent.reclaimableBytes;
    }),
    partial: budget.remaining <= 0,
  };
};

/*
 * Every path is checked again here: directly inside a resolved root, and a
 * disposable name. A failure is refused and reported, never quietly skipped.
 */
export const reclaimStorage = async (
  paths: readonly string[],
  options: RootResolutionOptions,
): Promise<ReclaimResult> => {
  const roots = resolveAgentPaths(options);
  const shared = projectRoots(options.home ?? homedir());
  const allowed = new Set(agentOptions.flatMap((option) => {
    return roots[option.id].filter((root) => {
      return !shared.has(root);
    });
  }));
  const removed: string[] = [];
  const refused: string[] = [];
  let freedBytes = 0;

  for (const path of new Set(paths)) {
    const budget: Budget = { remaining: MAX_ENTRIES };

    if (!allowed.has(dirname(path)) || !isReclaimable(basename(path))) {
      refused.push(path);
      continue;
    }

    const bytes = await sizeOf(path, 1, budget);

    try {
      await rm(path, {
        recursive: true,
        force: true,
      });
    }
    catch {
      refused.push(path);
      continue;
    }

    removed.push(path);
    freedBytes += bytes;
  }

  return {
    removed,
    freedBytes,
    refused,
  };
};
