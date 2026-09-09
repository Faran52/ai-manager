import type {
  EditedFile,
  EditKind,
  FileEdit,
} from '@services/edits/editsService';

const changesOfKind = (edits: readonly FileEdit[], kind: EditKind): number => {
  return edits.reduce((total, edit) => {
    return edit.kind === kind ? total + edit.changes : total;
  }, 0);
};

/**
 * The project's edit list, narrowed to one transcript.
 *
 * An open session asks what it changed, not what the project did, and the
 * counts are recomputed rather than carried over because a file the project
 * touched forty times may have been touched once here.
 */
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
