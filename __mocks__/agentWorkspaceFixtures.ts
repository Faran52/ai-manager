import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface AgentWorkspace {
  readonly home: string;
  readonly project: string;
}

/*
 * A home and a project side by side under one temp root, which is the shape
 * every agent reader takes: one path it finds configuration under and one it
 * is pointed at. The prefix names the suite so a failed run leaves a directory
 * that says which test left it.
 */
export const newAgentWorkspace = async (prefix: string): Promise<AgentWorkspace> => {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const home = join(root, 'home');
  const project = join(root, 'project');

  await mkdir(home, { recursive: true });
  await mkdir(project, { recursive: true });

  return {
    home,
    project,
  };
};

// The same pair with the .claude directories a Claude reader expects to find.
export const newClaudeWorkspace = async (prefix: string): Promise<AgentWorkspace> => {
  const workspace = await newAgentWorkspace(prefix);

  await mkdir(join(workspace.home, '.claude', 'plugins'), { recursive: true });
  await mkdir(join(workspace.project, '.claude'), { recursive: true });

  return workspace;
};
