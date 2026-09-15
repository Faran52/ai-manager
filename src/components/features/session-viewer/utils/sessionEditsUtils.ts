import { sumBy } from 'es-toolkit';

import type {
  EditedFile,
  EditKind,
  FileEdit,
} from '@services/edits/editsService';

const changesOfKind = (edits: readonly FileEdit[], kind: EditKind): number => {
  return sumBy(edits, (edit) => {
    return edit.kind === kind ? edit.changes : 0;
  });
};

// An open session asks what it changed, not what the project did, so the counts
// are recomputed: a file touched forty times here may have been touched once.
export const editsInSession = (
  files: readonly EditedFile[],
  sessionFilePath: string | undefined,
): readonly EditedFile[] => {
  if (sessionFilePath == null) {
    return files;
  }

  return files.flatMap((file) => {
    const recent = file.recent.filter((edit) => {
      return edit.sessionFilePath === sessionFilePath;
    });

    if (recent.length === 0) {
      return [];
    }

    return [{
      ...file,
      recent,
      edits: changesOfKind(recent, 'edit'),
      writes: changesOfKind(recent, 'write'),
      sessionCount: 1,
      lastEditedMs: Math.max(...recent.map((edit) => {
        return edit.timestampMs;
      })),
    }];
  });
};

/*
 * The name carries the row and the directory sits under it. A full path per row
 * means reading forty copies of the same prefix to find the one part that
 * differs, which is the filename.
 */
export const splitPath = (path: string, projectPath: string | undefined): {
  readonly name: string;
  readonly directory: string;
} => {
  const relative = projectPath != null && path.startsWith(projectPath)
    ? path.slice(projectPath.length).replace(/^\//u, '')
    : path;
  const cut = relative.lastIndexOf('/');

  return {
    name: cut === -1 ? relative : relative.slice(cut + 1),
    directory: cut === -1 ? '' : relative.slice(0, cut),
  };
};
