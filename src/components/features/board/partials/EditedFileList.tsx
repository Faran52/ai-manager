import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ChevronDown,
  FileDiff,
  GitCompare,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { cn } from '@utils/cnUtils';
import { formatTimeAgo } from '@utils/formatUtils';

import { collapseTransition } from '@ui/index';

import { FileDiffPanel } from './FileDiffPanel';

import type { EditedFile, FileEdit } from '@services/edits/editsService';
import type { FC } from 'react';

export interface EditedFileListProps {
  readonly files: readonly EditedFile[];
  readonly projectPath: string | undefined;
  readonly nowMs: number;
  readonly onOpenEdit: (edit: FileEdit) => void;
}

const shortenPath = (path: string, projectPath: string | undefined): string => {
  return projectPath != null && path.startsWith(projectPath)
    ? path.slice(projectPath.length).replace(/^\//u, '')
    : path;
};

export const EditedFileList: FC<EditedFileListProps> = ({
  files,
  projectPath,
  nowMs,
  onOpenEdit,
}) => {
  const { t } = useTranslation('board');
  const [openPath, setOpenPath] = useState<string>();
  const [diffSession, setDiffSession] = useState<string>();

  return (
    <ul className="grid gap-1" data-edited-files>
      {files.map((file) => {
        const open = file.path === openPath;

        return (
          <li
            key={file.path}
            className="rounded-lg border border-border bg-card"
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => {
                setDiffSession(undefined);
                setOpenPath(open ? undefined : file.path);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-start"
            >
              <FileDiff className="size-3.5 shrink-0 text-primary" />
              <span className="
                min-w-0 flex-1 truncate font-mono text-[11px] text-foreground
              "
              >
                {shortenPath(file.path, projectPath)}
              </span>
              <span className="
                shrink-0 text-[10px] text-muted-foreground tabular-nums
              "
              >
                {t('editCount', { count: file.edits + file.writes })}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatTimeAgo(file.lastEditedMs, nowMs)}
              </span>
              <ChevronDown
                className={cn(`
                  size-3.5 shrink-0 text-muted-foreground transition-transform
                `, open && 'rotate-180')}
              />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  transition={collapseTransition}
                  className="overflow-hidden"
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
                            onClick={() => {
                              onOpenEdit(edit);
                            }}
                            className="
                              flex min-w-0 flex-1 items-center gap-2 rounded-md
                              px-2 py-1 text-start
                              hover:bg-accent
                            "
                          >
                            <span className="
                              shrink-0 font-mono text-[10px]
                              text-muted-foreground
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
                              shrink-0 text-[10px] text-muted-foreground
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
                  {diffSession != null && (
                    <div className="border-t border-border px-3 py-2">
                      <FileDiffPanel sessionId={diffSession} path={file.path} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
};
