import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

import { agentOption, isAgentId } from '@config/agents';

import {
  isJsonArray,
  isJsonObject,
  parseJsonContainer,
} from '@utils/jsonUtils';

import { listAgentProjects, listAgentSessions } from '../agents/agentsService';

import type { AgentId } from '@config/agents';
import type { JsonValue } from '@utils/jsonUtils';
import type { AgentRoots } from '../agents/agentsService';

export interface ArchivedSession {
  readonly agent: AgentId;
  readonly projectId: string;
  readonly projectName: string;
  readonly actualSessionId: string;
  readonly title: string;
  readonly messageCount: number;
  readonly lastTimestampMs: number;
  readonly sizeBytes: number;
  readonly sourcePath: string;
  readonly archivePath: string;
}

export interface ArchiveManifest {
  readonly id: string;
  readonly createdMs: number;
  readonly note: string;
  readonly sessions: readonly ArchivedSession[];
}

export interface ArchiveSummary {
  readonly id: string;
  readonly createdMs: number;
  readonly note: string;
  readonly sessionCount: number;
  readonly sizeBytes: number;
  readonly agents: readonly AgentId[];
}

const MANIFEST = 'manifest.json';
const FILES_DIR = 'files';
const ID_PATTERN = /^[\w.-]+$/u;

export const archiveRoot = (home: string = homedir()): string => {
  return join(home, '.ai-manager', 'archives');
};

// Colons and plus signs are legal in an ISO string and illegal in a Windows path segment.
const archiveId = (createdMs: number): string => {
  return new Date(createdMs).toISOString().replaceAll(/[:.]/gu, '-');
};

const sessionTitle = (session: {
  readonly title?: string | undefined;
  readonly summary?: string | undefined;
  readonly preview?: string | undefined;
  readonly id: string;
}): string => {
  return session.title ?? session.summary ?? session.preview ?? session.id;
};

// A shared database holds every session for an agent at once, so copying it per
// session would multiply the whole file into the archive once per row.
const isArchivable = (agent: AgentId): boolean => {
  return agentOption(agent).artifact !== 'shared-db';
};

const safeSegment = (value: string): string => {
  return value.replaceAll(/[^\w.-]/gu, '_').slice(0, 120);
};

export const sessionKey = (agent: AgentId, actualSessionId: string): string => {
  return `${agent}:${actualSessionId}`;
};

/**
 * False rather than a throw: an agent may delete the very transcript being
 * copied, which is the race this feature exists to survive, so one lost file
 * must not abandon the rest of the archive.
 */
export const copySession = async (source: string, destination: string): Promise<boolean> => {
  try {
    await mkdir(join(destination, '..'), { recursive: true });
    await cp(source, destination, { recursive: true });

    return true;
  }
  catch {
    return false;
  }
};

export const createArchive = async (
  roots: AgentRoots,
  note = '',
  home?: string,
  only?: ReadonlySet<string>,
): Promise<ArchiveManifest> => {
  const createdMs = Date.now();
  const id = archiveId(createdMs);
  const target = join(archiveRoot(home), id);
  const projects = await listAgentProjects(roots);
  const sessions: ArchivedSession[] = [];

  await mkdir(target, { recursive: true });

  for (const project of projects) {
    if (!isArchivable(project.agent)) {
      continue;
    }

    const found = await listAgentSessions(roots, project.agent, project.id);

    for (const session of found) {
      if (only != null && !only.has(sessionKey(session.agent, session.actualSessionId))) {
        continue;
      }

      const relativePath = join(
        FILES_DIR,
        project.agent,
        safeSegment(project.id),
        basename(session.filePath),
      );
      const destination = join(target, relativePath);

      if (!await copySession(session.filePath, destination)) {
        continue;
      }

      sessions.push({
        agent: project.agent,
        projectId: project.id,
        projectName: project.name,
        actualSessionId: session.actualSessionId,
        title: sessionTitle(session),
        messageCount: session.messageCount,
        lastTimestampMs: session.lastTimestampMs,
        sizeBytes: session.sizeBytes,
        sourcePath: session.filePath,
        archivePath: destination,
      });
    }
  }

  const manifest: ArchiveManifest = {
    id,
    createdMs,
    note: note.slice(0, 200),
    sessions,
  };

  await writeFile(join(target, MANIFEST), JSON.stringify(manifest), 'utf8');

  return manifest;
};

const archivedSessionFrom = (value: JsonValue): ArchivedSession | undefined => {
  if (!isJsonObject(value)
    || typeof value.agent !== 'string' || !isAgentId(value.agent)
    || typeof value.projectId !== 'string'
    || typeof value.projectName !== 'string'
    || typeof value.actualSessionId !== 'string'
    || typeof value.title !== 'string'
    || typeof value.messageCount !== 'number'
    || typeof value.lastTimestampMs !== 'number'
    || typeof value.sizeBytes !== 'number'
    || typeof value.sourcePath !== 'string'
    || typeof value.archivePath !== 'string') {
    return undefined;
  }

  return {
    agent: value.agent,
    projectId: value.projectId,
    projectName: value.projectName,
    actualSessionId: value.actualSessionId,
    title: value.title,
    messageCount: value.messageCount,
    lastTimestampMs: value.lastTimestampMs,
    sizeBytes: value.sizeBytes,
    sourcePath: value.sourcePath,
    archivePath: value.archivePath,
  };
};

const manifestFrom = (value: JsonValue): ArchiveManifest | undefined => {
  if (!isJsonObject(value)
    || typeof value.id !== 'string'
    || typeof value.createdMs !== 'number'
    || typeof value.note !== 'string'
    || !isJsonArray(value.sessions)) {
    return undefined;
  }

  const sessions = value.sessions.map(archivedSessionFrom);

  if (sessions.includes(undefined)) {
    return undefined;
  }

  return {
    id: value.id,
    createdMs: value.createdMs,
    note: value.note,
    sessions: sessions.filter((session) => {
      return session != null;
    }),
  };
};

export const readArchive = async (id: string, home?: string): Promise<ArchiveManifest | undefined> => {
  if (!ID_PATTERN.test(id)) {
    return undefined;
  }

  try {
    return manifestFrom(parseJsonContainer(await readFile(join(archiveRoot(home), id, MANIFEST), 'utf8')));
  }
  catch {
    return undefined;
  }
};

const summarise = (manifest: ArchiveManifest): ArchiveSummary => {
  const agents = new Set<AgentId>();
  let sizeBytes = 0;

  for (const session of manifest.sessions) {
    agents.add(session.agent);
    sizeBytes += session.sizeBytes;
  }

  return {
    id: manifest.id,
    createdMs: manifest.createdMs,
    note: manifest.note,
    sessionCount: manifest.sessions.length,
    sizeBytes,
    agents: [...agents],
  };
};

export const listArchives = async (home?: string): Promise<readonly ArchiveSummary[]> => {
  let names: readonly string[];

  try {
    names = await readdir(archiveRoot(home));
  }
  catch {
    return [];
  }

  const manifests = await Promise.all(names.map(async (name) => {
    return readArchive(name, home);
  }));

  return manifests
    .filter((manifest): manifest is ArchiveManifest => {
      return manifest != null;
    })
    .map(summarise)
    .sort((left, right) => {
      return right.createdMs - left.createdMs;
    });
};

/**
 * Reports whether there was an archive to remove. An id naming nothing is an
 * ordinary answer rather than a failure, so the caller can say "no such
 * archive" instead of raising a thrown error into an unexpected server error.
 */
export const deleteArchive = async (id: string, home?: string): Promise<boolean> => {
  if (!ID_PATTERN.test(id)) {
    throw new Error('Unknown archive.');
  }

  const target = join(archiveRoot(home), id);

  try {
    await stat(target);
  }
  catch {
    return false;
  }

  await rm(target, { recursive: true });

  return true;
};
