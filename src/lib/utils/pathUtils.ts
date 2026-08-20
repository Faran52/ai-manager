import { realpath } from 'node:fs/promises';
import { relative } from 'node:path';

// True when the resolved candidate lives inside one of the roots, so symlinks cannot smuggle paths out.
export const containedIn = async (roots: readonly string[], candidate: string): Promise<boolean> => {
  let resolved: string;

  try {
    resolved = await realpath(candidate);
  }
  catch {
    return false;
  }

  for (const root of roots) {
    try {
      const nested = relative(await realpath(root), resolved);

      if (!nested.startsWith('..')) {
        return true;
      }
    }
    catch {
      continue;
    }
  }

  return false;
};
