import {
  appendFile,
  lstat,
  realpath,
  rm,
} from 'node:fs/promises';
import { join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { agentOption } from '@config/agents';

import { containedIn } from '@utils/pathUtils';

import { pathsFor } from '../../agents/agentsService';
import { deleteOpenCodeSession } from '../../history/utils/openCodeUtils';

import type { AgentId, AgentOption } from '@config/agents';
import type { AgentRoots } from '../../agents/agentsService';

export interface SessionMutationTarget {
  readonly agent: AgentId;
  readonly filePath: string;
  readonly actualSessionId: string;
}

export interface ProjectMutationTarget {
  readonly agent: AgentId;
  readonly projectId: string;
}

// Every file-backed agent whose sessions can be changed stores them as JSONL.
const SESSION_EXTENSION = '.jsonl';

const requireDeletableAgent = (option: AgentOption): void => {
  if (!option.canDelete) {
    throw new Error(option.artifact === 'shared-db'
      ? 'This agent keeps its sessions inside a shared database, so they stay read-only.'
      : 'This agent does not support session changes.');
  }
};

const safeSessionPath = async (
  roots: AgentRoots,
  target: SessionMutationTarget,
): Promise<string> => {
  const option = agentOption(target.agent);

  requireDeletableAgent(option);

  if (!target.filePath.endsWith(SESSION_EXTENSION)) {
    throw new Error('Only JSONL session files can be changed.');
  }

  const [sessionPath, facts] = await Promise.all([realpath(target.filePath), lstat(target.filePath)]);

  if (facts.isSymbolicLink() || !facts.isFile() || !await containedIn(pathsFor(roots, target.agent), sessionPath)) {
    throw new Error('The session path is outside its agent history directory.');
  }

  return sessionPath;
};

const codexDatabase = (roots: AgentRoots): DatabaseSync => {
  return new DatabaseSync(join(roots.codex[0], 'state_5.sqlite'));
};

export const renameSession = async (
  roots: AgentRoots,
  target: SessionMutationTarget,
  rawTitle: string,
): Promise<void> => {
  const title = rawTitle.trim();

  if (title.length === 0 || title.length > 200 || title.includes('\n') || title.includes('\r')) {
    throw new Error('Enter a title between 1 and 200 characters.');
  }

  await safeSessionPath(roots, target);

  if (target.agent === 'codex') {
    const database = codexDatabase(roots);

    try {
      database.prepare('UPDATE threads SET name = ?, title = ?, updated_at = ? WHERE id = ?')
        .run(title, title, Math.floor(Date.now() / 1000), target.actualSessionId);
    }
    finally {
      database.close();
    }

    return;
  }

  const line = JSON.stringify({
    type: 'custom-title',
    customTitle: title,
    sessionId: target.actualSessionId,
  });

  await appendFile(target.filePath, `\n${line}\n`, 'utf8');
};

// Deletion is permanent everywhere: the confirmation dialog is the safety net.
export const deleteSession = async (
  roots: AgentRoots,
  target: SessionMutationTarget,
): Promise<void> => {
  const option = agentOption(target.agent);

  requireDeletableAgent(option);

  if (option.format === 'opencode') {
    await deleteOpenCodeSession(target.filePath, pathsFor(roots, target.agent));

    return;
  }

  const filePath = await safeSessionPath(roots, target);

  await rm(filePath);

  if (target.agent === 'codex') {
    const database = codexDatabase(roots);

    try {
      database.prepare('DELETE FROM threads WHERE id = ?').run(target.actualSessionId);
    }
    finally {
      database.close();
    }
  }
};

export const deleteProject = async (
  roots: AgentRoots,
  target: ProjectMutationTarget,
): Promise<void> => {
  if (!agentOption(target.agent).canDeleteProject || target.agent !== 'claude') {
    throw new Error('This agent does not store projects in deletable history folders.');
  }

  const projectsDir = join(roots.claude[0], 'projects');
  const requestedPath = join(projectsDir, target.projectId);
  const [rootPath, projectPath, facts] = await Promise.all([
    realpath(projectsDir),
    realpath(requestedPath),
    lstat(requestedPath),
  ]);
  const nestedPath = relative(rootPath, projectPath);

  if (facts.isSymbolicLink() || !facts.isDirectory() || nestedPath.startsWith('..') || nestedPath === '') {
    throw new Error('The project history folder is outside the agent history directory.');
  }

  await rm(projectPath, { recursive: true });
};
