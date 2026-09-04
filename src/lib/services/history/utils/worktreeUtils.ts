import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { ProjectSummary } from '../types';

interface ResolvedRoot {
  readonly path: string;
  readonly repoPath: string;
}

/*
 * A linked worktree's `.git` is a file rather than a directory, and it names
 * the repository that owns it:
 *
 *   gitdir: /path/to/repo/.git/worktrees/<name>
 *
 * ponytail: this reads the layout `git worktree add` writes. A repository moved
 * with --separate-git-dir points elsewhere, and the pointer to follow then is
 * the `commondir` file beside that gitdir; read it if such a store turns up.
 */
const GITDIR_PREFIX = 'gitdir:';
const WORKTREE_SEGMENT = '/worktrees/';

/**
 * The repository a path belongs to, when that path is a linked worktree.
 *
 * Undefined for the main tree, for a folder that is not a repository at all,
 * and for anything unreadable, because all three mean the same thing here:
 * this project is grouped under its own path.
 */
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

/**
 * Tags each project with the repository it is a worktree of.
 *
 * A branch checked out beside the main tree is its own folder, so every agent
 * records it as a separate project. They are one piece of work, and the sidebar
 * groups on this to say so. One small read per distinct folder, deduplicated,
 * because several agents commonly report the same one.
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
