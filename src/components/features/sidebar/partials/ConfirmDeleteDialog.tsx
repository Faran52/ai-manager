import { Trash2, TriangleAlert } from 'lucide-react';

import { singleLine } from '@utils/formatUtils';

import { ConfirmDialog, useLastPresent } from '@ui/index';

import type { SessionSummary } from '@services/history/historyService';
import type { FC } from 'react';

export interface ConfirmDeleteDialogProps {
  readonly sessions: readonly SessionSummary[];
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (sessions: readonly SessionSummary[]) => void;
}

export const ConfirmDeleteDialog: FC<ConfirmDeleteDialogProps> = ({
  sessions,
  busy,
  onClose,
  onConfirm,
}) => {
  const open = sessions.length > 0;
  const target = useLastPresent(open ? sessions : null);
  const first = target?.[0];
  const count = target?.length ?? 0;
  const title = first == null
    ? ''
    : singleLine(first.title ?? first.summary ?? first.preview ?? first.actualSessionId, 80);

  return (
    <ConfirmDialog
      open={open}
      labelledBy="delete-session-title"
      icon={<Trash2 className="size-4 text-destructive" />}
      heading={count === 1 ? 'Delete session permanently?' : `Delete ${String(count)} sessions permanently?`}
      description={(
        <div className="mt-2 text-sm">
          <p className="text-muted-foreground">
            {count === 1
              ? `“${title}” will be permanently deleted.`
              : `${String(count)} selected sessions will be permanently deleted.`}
          </p>
          <p className="
            mt-2 flex items-center gap-1.5 font-medium text-destructive
          "
          >
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            This cannot be undone.
          </p>
        </div>
      )}
      confirmLabel={count === 1 ? 'Delete permanently' : `Delete ${String(count)} permanently`}
      busyLabel="Deleting…"
      busy={busy}
      onClose={onClose}
      onConfirm={target == null
        ? undefined
        : () => {
            onConfirm(target);
          }}
    />
  );
};
