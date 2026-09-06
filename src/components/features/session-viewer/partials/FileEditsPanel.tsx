import { useTranslation } from 'react-i18next';

import {
  CircleAlert,
  FileDiff,
  X,
} from 'lucide-react';

import { Spinner } from '@ui/index';
import { EditedFileList } from '@features/board';

import type { EditedFile, FileEdit } from '@services/edits/editsService';
import type { FC } from 'react';

export interface FileEditsPanelProps {
  readonly files: readonly EditedFile[];
  readonly projectPath: string | undefined;
  readonly width: number;
  readonly nowMs: number;
  readonly onOpenEdit?: ((edit: FileEdit) => void)
    | undefined;
  readonly onClose: () => void;
  // A scan still running must not read as a session that changed nothing.
  readonly status: 'loading' | 'ready' | 'error';
  readonly error?: string | undefined;
}

/**
 * The edits belong to the session being read, so they sit beside the
 * conversation that made them. Swapping the transcript out for them, which is
 * what the tab strip did, breaks the one relationship worth showing.
 */
export const FileEditsPanel: FC<FileEditsPanelProps> = ({
  files,
  projectPath,
  width,
  nowMs,
  onOpenEdit,
  onClose,
  status,
  error,
}) => {
  const { t } = useTranslation('session');

  return (
    <aside
      className="flex h-full shrink-0 flex-col bg-card/55"
      style={{ width }}
      aria-label={t('fileEdits')}
      data-file-edits-panel
    >
      <header className="
        flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-3
      "
      >
        <FileDiff className="size-3.5 text-primary" />
        <h3 className="
          min-w-0 flex-1 truncate text-xs font-semibold text-foreground
        "
        >
          {t('fileEdits')}
        </h3>
        <span className="
          font-mono text-figure text-muted-foreground tabular-nums
        "
        >
          {files.length}
        </span>
        <button
          type="button"
          className="
            rounded-md p-1 text-muted-foreground
            hover:bg-accent hover:text-foreground
          "
          aria-label={t('closeFileEdits')}
          onClick={onClose}
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {status === 'loading' && <Spinner />}

        {status === 'error' && (
          <p className="
            flex items-center gap-2 rounded-lg border border-destructive/40
            bg-destructive/10 px-3 py-2 text-body text-destructive
          "
          >
            <CircleAlert className="size-3.5" />
            {error}
          </p>
        )}

        {status === 'ready' && files.length === 0 && (
          <p className="p-2 text-body text-muted-foreground">{t('noFileEdits')}</p>
        )}

        {files.length > 0 && (
          <EditedFileList
            files={files}
            projectPath={projectPath}
            nowMs={nowMs}
            onOpenEdit={onOpenEdit}
          />
        )}
      </div>
    </aside>
  );
};
