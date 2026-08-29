import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { agentOption, isAgentId } from '@config/agents';

import { parseJsonContainer } from '@utils/jsonUtils';

import { listAgentProjects, listAgentSessions } from '../agents/agentsService';
import {
  createArchive,
  listArchives,
  readArchive,
  sessionKey,
} from '../archive/archiveService';

import type { AgentId } from '@config/agents';
import type { AgentRoots } from '../agents/agentsService';
import type { SessionSummary } from '../history/historyService';

export interface RetentionPolicy {
  readonly enabled: boolean;
  readonly olderThanDays: number;
  readonly agents: readonly AgentId[];
}

export interface RetentionDue {
  readonly sessions: readonly SessionSummary[];
}

export interface RetentionRun {
  readonly archived: number;
  readonly archiveId: string | undefined;
}

export const defaultRetentionPolicy: RetentionPolicy = {
  enabled: false,
  olderThanDays: 30,
  agents: [],
};

const retentionPath = (home: string = homedir()): string => {
  return join(home, '.ai-chat-manager', 'retention.json');
};

const isRetentionPolicy = (value: unknown): value is RetentionPolicy => {
  if (typeof value !== 'object' || value === null
    || !('enabled' in value) || typeof value.enabled !== 'boolean'
    || !('olderThanDays' in value) || typeof value.olderThanDays !== 'number'
    || !Number.isFinite(value.olderThanDays)
    || value.olderThanDays < 1 || !Number.isInteger(value.olderThanDays)
    || !('agents' in value) || !Array.isArray(value.agents)) {
    return false;
  }

  return value.agents.every((agent) => {
    return typeof agent === 'string' && isAgentId(agent);
  });
};

export const readRetentionPolicy = async (home?: string): Promise<RetentionPolicy> => {
  try {
    const policy = parseJsonContainer(await readFile(retentionPath(home), 'utf8'));

    return isRetentionPolicy(policy) ? policy : defaultRetentionPolicy;
  }
  catch {
    return defaultRetentionPolicy;
  }
};

export const writeRetentionPolicy = async (policy: RetentionPolicy, home?: string): Promise<RetentionPolicy> => {
  await mkdir(join(retentionPath(home), '..'), { recursive: true });
  await writeFile(retentionPath(home), JSON.stringify(policy), 'utf8');

  return policy;
};

const archivedKeys = async (home?: string): Promise<ReadonlySet<string>> => {
  const archives = await listArchives(home);
  const manifests = await Promise.all(archives.map(async (archive) => {
    return readArchive(archive.id, home);
  }));
  const keys = new Set<string>();

  for (const manifest of manifests) {
    // v8 ignore next -- listArchives only returns manifests it has already read successfully.
    if (manifest == null) {
      continue;
    }

    for (const session of manifest.sessions) {
      keys.add(sessionKey(session.agent, session.actualSessionId));
    }
  }

  return keys;
};

export const dueForArchive = async (
  roots: AgentRoots,
  policy: RetentionPolicy,
  home?: string,
): Promise<RetentionDue> => {
  const cutoff = Date.now() - policy.olderThanDays * 24 * 60 * 60 * 1000;
  const selected = new Set(policy.agents);
  const archived = await archivedKeys(home);
  const projects = await listAgentProjects(roots);
  const sessions: SessionSummary[] = [];

  for (const project of projects) {
    if (agentOption(project.agent).artifact === 'shared-db'
      || (selected.size > 0 && !selected.has(project.agent))) {
      continue;
    }

    const found = await listAgentSessions(roots, project.agent, project.id);

    for (const session of found) {
      if (session.lastTimestampMs < cutoff
        && !archived.has(sessionKey(session.agent, session.actualSessionId))) {
        sessions.push(session);
      }
    }
  }

  return { sessions };
};

export const runRetention = async (roots: AgentRoots, home?: string): Promise<RetentionRun> => {
  const policy = await readRetentionPolicy(home);

  if (!policy.enabled) {
    return {
      archived: 0,
      archiveId: undefined,
    };
  }

  const due = await dueForArchive(roots, policy, home);

  if (due.sessions.length === 0) {
    return {
      archived: 0,
      archiveId: undefined,
    };
  }

  // A session can grow after this copy, but versioning each transcript needs a separate retention model.
  const manifest = await createArchive(
    roots,
    `Retention: sessions older than ${String(policy.olderThanDays)} days`,
    home,
    new Set(due.sessions.map((session) => {
      return sessionKey(session.agent, session.actualSessionId);
    })),
  );

  return {
    archived: manifest.sessions.length,
    archiveId: manifest.id,
  };
};
