import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { agentOption, agentOptions } from '@config/agents';

import { resolveAgentPaths } from '../agents/agentsService';

import type { AgentId } from '@config/agents';
import type { RootResolutionOptions } from '../agents/agentsService';

export interface StorageEntry {
  readonly name: string;
  readonly path: string;
  readonly bytes: number;
}

export interface AgentStorage {
  readonly agent: AgentId;
  readonly label: string;
  readonly bytes: number;
  // The largest things inside, so a total has somewhere to point.
  readonly entries: readonly StorageEntry[];
}

export interface StorageReport {
  readonly agents: readonly AgentStorage[];
  readonly totalBytes: number;
  // True when a walk stopped at its limit, so the totals read as at least rather than exactly.
  readonly partial: boolean;
}

interface Budget {
  remaining: number;
}

/**
 * Measuring 1.5 GB by walking every file would block the request for seconds,
 * and the answer only has to be good enough to point at what is large. Depth
 * stops the walk inside deep trees, and the entry budget stops one enormous
 * directory from starving the rest.
 */
const MAX_DEPTH = 4;
const MAX_ENTRIES = 40_000;
const TOP_ENTRIES = 6;

const sizeOf = async (path: string, depth: number, budget: Budget): Promise<number> => {
  if (budget.remaining <= 0) {
    return 0;
  }

  budget.remaining -= 1;

  let facts;

  try {
    facts = await stat(path);
  }
  catch {
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

  return sizes.reduce((total, size) => {
    return total + size;
  }, 0);
};

/**
 * One walk per root, not two: the children are sized individually and the total
 * is their sum, so a root is never traversed once for its size and again for
 * its contents.
 */
const measureRoot = async (root: string, budget: Budget): Promise<{
  readonly bytes: number;
  readonly entries: readonly StorageEntry[];
}> => {
  let facts;

  try {
    facts = await stat(root);
  }
  catch {
    return {
      bytes: 0,
      entries: [],
    };
  }

  if (!facts.isDirectory()) {
    return {
      bytes: facts.size,
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
      entries: [],
    };
  }

  const measured = await Promise.all(names.map(async (name) => {
    const path = join(root, name);

    return {
      name,
      path,
      bytes: await sizeOf(path, 1, budget),
    };
  }));

  return {
    bytes: measured.reduce((total, entry) => {
      return total + entry.bytes;
    }, 0),
    entries: measured
      .filter((entry) => {
        return entry.bytes > 0;
      })
      .sort((left, right) => {
        return right.bytes - left.bytes;
      })
      .slice(0, TOP_ENTRIES),
  };
};

/**
 * Some agents keep their history inside the projects themselves rather than in
 * a directory of their own, so their roots are ordinary source folders. Sizing
 * those would report the user's code, node_modules and build output as agent
 * storage, which is worse than reporting nothing, so they are skipped.
 */
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
      entries = [...entries, ...measured.entries];
    }

    if (bytes > 0) {
      agents.push({
        agent: option.id,
        label: agentOption(option.id).label,
        bytes,
        entries: [...entries].sort((left, right) => {
          return right.bytes - left.bytes;
        }).slice(0, TOP_ENTRIES),
      });
    }
  }

  agents.sort((left, right) => {
    return right.bytes - left.bytes;
  });

  return {
    agents,
    totalBytes: agents.reduce((total, agent) => {
      return total + agent.bytes;
    }, 0),
    partial: budget.remaining <= 0,
  };
};
