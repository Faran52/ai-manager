import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { ProjectSummary } from '../types';

interface ResolvedRoot {
  readonly path: string;
  readonly repoPath: string;
}

/*
 * A linked worktree .git is a file naming its repository, as
 * "gitdir: /path/to/repo/.git/worktrees/<name>". ponytail: this reads what
 * git worktree add writes; follow commondir if a --separate-git-dir store turns up.
 */
const GITDIR_PREFIX = 'gitdir:';
const WORKTREE_SEGMENT = '/worktrees/';

// Undefined for the main tree, a folder that is no repository, and anything
// unreadable: all three mean the project groups under its own path.
export const repoRootOf = async (projectPath: string): Promise<string | undefined> => {
  try {
    const marker = (await readFile(join(projectPath, '.git'), 'utf8')).trim();

    if (!marker.startsWith(GITDIR_PREFIX)) {
      return undefined;
    }

    const gitDir = marker.slice(GITDIR_PREFIX.length).trim();
    const cut = gitDir.lastIndexOf(WORKTREE_SEGMENT);

    /*
     * What follows the segment is the worktree's own name, so a further slash
     * after it means this is some other path that merely contains the word.
     * What precedes it is the repository's git directory.
     */
    return cut === -1 || gitDir.includes('/', cut + WORKTREE_SEGMENT.length)
      ? undefined
      : dirname(gitDir.slice(0, cut));
  }
  catch {
    return undefined;
  }
};

/*
 * A branch checked out beside the main tree is its own folder, so every agent
 * records it as a separate project. They are one piece of work. One read per
 * distinct folder, deduplicated, since agents commonly report the same one.
 */
export const withRepoRoots = async (
  projects: readonly ProjectSummary[],
): Promise<readonly ProjectSummary[]> => {
  const paths = [...new Set(projects.flatMap((project) => {
    return project.actualPath == null ? [] : [project.actualPath];
  }))];

  const resolved = await Promise.all(paths.map(async (path): Promise<ResolvedRoot | undefined> => {
    const repoPath = await repoRootOf(path);

    // A main tree resolves to itself, which is no grouping at all.
    return repoPath == null || repoPath === path
      ? undefined
      : {
          path,
          repoPath,
        };
  }));

  const pairs: (readonly [string, string])[] = [];

  for (const found of resolved) {
    if (found != null) {
      pairs.push([found.path, found.repoPath]);
    }
  }

  if (pairs.length === 0) {
    return projects;
  }

  const byPath = new Map(pairs);

  return projects.map((project) => {
    const repoPath = project.actualPath == null ? undefined : byPath.get(project.actualPath);

    return repoPath == null
      ? project
      : {
          ...project,
          repoPath,
        };
  });
};
