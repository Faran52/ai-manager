import {
  appendFile,
  lstat,
  realpath,
  rm,
  stat,
} from 'node:fs/promises';
import {
  basename,
  dirname,
  extname,
  join,
  relative,
} from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { agentOption } from '@config/agents';

import { containedIn } from '@utils/pathUtils';

import { listAgentSessions, pathsFor } from '../../agents/agentsService';
import { deleteOpenCodeSession } from '../../history/utils/openCodeUtils';
import { deleteSqliteSession } from '../../history/utils/sqliteUtils';
import { forgetSessionPrompts } from '../../prompts/promptsService';

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

const SESSION_EXTENSIONS = new Set(['.json', '.jsonl', '.md', '.ndjson', '.txt']);

const OUTSIDE = 'The session path is outside its agent history directory.';

const requireDeletable = (option: AgentOption): void => {
  if (!option.canDelete) {
    throw new Error('This agent keeps its sessions inside a shared database, so they stay read-only.');
  }
};

const safeSessionPath = async (
  roots: AgentRoots,
  target: SessionMutationTarget,
  wantFile: boolean,
): Promise<string> => {
  const [sessionPath, facts] = await Promise.all([realpath(target.filePath), lstat(target.filePath)]);

  if (facts.isSymbolicLink()
    || (wantFile && !facts.isFile())
    || !await containedIn(pathsFor(roots, target.agent), sessionPath)) {
    throw new Error(OUTSIDE);
  }

  return sessionPath;
};

const safeSessionFile = async (
  roots: AgentRoots,
  target: SessionMutationTarget,
  extensions: ReadonlySet<string> = SESSION_EXTENSIONS,
): Promise<string> => {
  if (!extensions.has(extname(target.filePath).toLowerCase())) {
    throw new Error('That file is not a transcript this agent stores.');
  }

  return safeSessionPath(roots, target, true);
};

// Which file the reader opens differs per agent; the folder carries the id.
const safeSessionDirectory = async (
  roots: AgentRoots,
  target: SessionMutationTarget,
): Promise<string> => {
  let current = await safeSessionPath(roots, target, false);

  while (basename(current) !== target.actualSessionId) {
    const parent = dirname(current);

    if (parent === current) {
      throw new Error('No session folder above that path carries the session id.');
    }

    current = parent;
  }

  if (!(await stat(current)).isDirectory() || !await containedIn(pathsFor(roots, target.agent), current)) {
    throw new Error(OUTSIDE);
  }

  return current;
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

  if (!agentOption(target.agent).canRename) {
    throw new Error('This agent does not support renaming a session.');
  }

  if (title.length === 0 || title.length > 200 || title.includes('\n') || title.includes('\r')) {
    throw new Error('Enter a title between 1 and 200 characters.');
  }

  await safeSessionFile(roots, target, new Set(['.jsonl']));

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
  home?: string,
): Promise<void> => {
  const option = agentOption(target.agent);

  requireDeletable(option);

  if (option.artifact === 'shared-db') {
    await (option.format === 'opencode' ? deleteOpenCodeSession : deleteSqliteSession)(
      target.filePath,
      pathsFor(roots, target.agent),
    );

    return;
  }

  if (option.artifact === 'directory') {
    await rm(await safeSessionDirectory(roots, target), { recursive: true });

    return;
  }

  await rm(await safeSessionFile(roots, target));

  // Only Claude Code keeps a prompt record, and only its own sessions appear in it.
  if (target.agent === 'claude') {
    await forgetSessionPrompts(target.actualSessionId, home);
  }

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

const deleteProjectFolder = async (
  roots: AgentRoots,
  target: ProjectMutationTarget,
): Promise<void> => {
  const [root] = pathsFor(roots, target.agent);

  if (root == null) {
    throw new Error('This agent has no history directory on this machine.');
  }

  const projectsDir = join(root, 'projects');
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

export const deleteProject = async (
  roots: AgentRoots,
  target: ProjectMutationTarget,
): Promise<void> => {
  const option = agentOption(target.agent);

  if (!option.canDeleteProject) {
    throw new Error('This agent does not store projects in deletable history folders.');
  }

  if (option.format === 'claude') {
    await deleteProjectFolder(roots, target);

    return;
  }

  // Sequential: a shared store takes one writer at a time.
  for (const session of await listAgentSessions(roots, target.agent, target.projectId)) {
    await deleteSession(roots, {
      agent: target.agent,
      filePath: session.filePath,
      actualSessionId: session.actualSessionId,
    });
  }
};
