import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FileText, GitCompare } from 'lucide-react';

import { cn } from '@utils/cnUtils';
import { formatTimeAgo } from '@utils/formatUtils';

import { Disclosure } from '@ui/index';

import { FileDiffPanel } from './FileDiffPanel';

import type { EditedFile, FileEdit } from '@services/edits/editsService';
import type { FC } from 'react';

export interface EditedFileListProps {
  readonly files: readonly EditedFile[];
  readonly projectPath: string | undefined;
  readonly nowMs: number;
  /*
   * Absent inside a session's own edits panel: the row would jump to the
   * session already on screen, so it is a plain row there rather than a
   * control that does nothing.
   */
  readonly onOpenEdit?: ((edit: FileEdit) => void)
    | undefined;
}

/*
 * The name carries the row and the directory sits under it. A full path per row
 * means reading forty copies of the same prefix to find the one part that
 * differs, which is the filename.
 */
const splitPath = (path: string, projectPath: string | undefined): {
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

export const EditedFileList: FC<EditedFileListProps> = ({
  files,
  projectPath,
  nowMs,
  onOpenEdit,
}) => {
  const { t } = useTranslation('session');
  const [openPath, setOpenPath] = useState<string>();
  const [diffSession, setDiffSession] = useState<string>();

  return (
    <ul className="grid gap-px" data-edited-files>
      {files.map((file) => {
        const open = file.path === openPath;
        const { name, directory } = splitPath(file.path, projectPath);

        return (
          <li key={file.path} className="rounded-md">
            <Disclosure
              open={open}
              onOpenChange={(next) => {
                setDiffSession(undefined);
                setOpenPath(next ? file.path : undefined);
              }}
              triggerClassName={cn(
                'gap-2 rounded-md px-2.5 py-1.5',
                open ? 'bg-accent' : 'hover:bg-accent',
              )}
              summary={(
                <>
                  <FileText className="size-3.5 shrink-0 text-faint" />
                  <span className="grid min-w-0 flex-1" title={file.path}>
                    <span className="
                      truncate font-mono text-body text-foreground
                    "
                    >
                      {name}
                    </span>
                    {directory !== '' && (
                      <span className="truncate font-mono text-figure text-dim">
                        {directory}
                      </span>
                    )}
                  </span>
                  <span className="
                    shrink-0 text-figure text-muted-foreground tabular-nums
                  "
                  >
                    {t('editCount', { count: file.edits + file.writes })}
                  </span>
                  <span className="shrink-0 text-figure text-muted-foreground">
                    {formatTimeAgo(file.lastEditedMs, nowMs)}
                  </span>
                </>
              )}
            >
              <ul className="grid gap-0.5 border-t border-border px-3 py-2">
                {file.recent.map((edit) => {
                  return (
                    <li
                      key={`${edit.sessionId}-${String(edit.timestampMs)}`}
                      className="flex items-center gap-1"
                    >
                      <button
                        type="button"
                        disabled={onOpenEdit == null}
                        onClick={() => {
                          onOpenEdit?.(edit);
                        }}
                        className="
                          flex min-w-0 flex-1 items-center gap-2 rounded-md px-2
                          py-1 text-start
                          enabled:hover:bg-accent
                        "
                      >
                        <span className="
                          shrink-0 font-mono text-figure text-muted-foreground
                        "
                        >
                          {t(edit.kind === 'write' ? 'written' : 'edited')}
                        </span>
                        <span className="
                          min-w-0 flex-1 truncate text-xs text-foreground
                        "
                        >
                          {edit.sessionTitle}
                        </span>
                        <span className="
                          shrink-0 text-figure text-muted-foreground
                        "
                        >
                          {formatTimeAgo(edit.timestampMs, nowMs)}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={t('showDiff')}
                        aria-pressed={diffSession === edit.sessionId}
                        data-show-diff={edit.sessionId}
                        onClick={() => {
                          setDiffSession(diffSession === edit.sessionId
                            ? undefined
                            : edit.sessionId);
                        }}
                        className={cn(`
                          shrink-0 rounded-md p-1 text-muted-foreground
                          hover:bg-accent hover:text-foreground
                        `, diffSession === edit.sessionId && 'text-primary')}
                      >
                        <GitCompare className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Disclosure>
            {/* Outside the row's collapse: the diff loads a spinner first and
                then a tall PatchView, and a height-animated parent would clip
                the growth. */}
            {open && diffSession != null && (
              <div className="border-t border-border px-3 py-2">
                <FileDiffPanel sessionId={diffSession} path={file.path} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};
