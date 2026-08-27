import { useTranslation } from 'react-i18next';

import { FolderX, TriangleAlert } from 'lucide-react';

import { agentOption } from '@config/agents';

import { ConfirmDialog, useLastPresent } from '@ui/index';

import type { ProjectSummary } from '@services/history/historyService';
import type { FC } from 'react';

export interface ConfirmDeleteProjectDialogProps {
  readonly project: ProjectSummary | null;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (project: ProjectSummary) => void;
}

export const ConfirmDeleteProjectDialog: FC<ConfirmDeleteProjectDialogProps> = ({
  project,
  busy,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation('sidebar');
  const open = project != null;
  const target = useLastPresent(project);
  const agentLabel = target == null ? 'the agent' : agentOption(target.agent).label;

  return (
    <ConfirmDialog
      open={open}
      labelledBy="delete-project-title"
      icon={<FolderX className="size-4 text-destructive" />}
      heading={t('deleteProjectConfirm')}
      description={(
        <div className="mt-2 text-sm">
          <p className="text-muted-foreground">
            {`Everything ${agentLabel} has stored for “${target?.name ?? ''}” will be permanently deleted.`}
          </p>
          <ul className="
            mt-2 list-disc ps-5 text-xs text-muted-foreground
            marker:text-muted-foreground/50
          "
          >
            <li>{`${String(target?.sessionCount ?? 0)} stored sessions, with their transcripts`}</li>
            <li>{t('renamedTitles')}</li>
            <li>{t('deleteProjectDetail')}</li>
          </ul>
          <p className="
            mt-2 flex items-center gap-1.5 font-medium text-destructive
          "
          >
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            {t('cannotBeUndone')}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Your source project folder on disk is untouched; only the agent's stored history is removed.
          </p>
        </div>
      )}
      confirmLabel={t('deletePermanently', { ns: 'common' })}
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
