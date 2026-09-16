import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Archive,
  CircleAlert,
  Loader2,
  Plus,
} from 'lucide-react';

import { createArchive, deleteArchive } from '@lib/apis/apiClient';
import { projectKeyOf } from '@services/history/historyService';
import { sizeLabel } from '@utils/formatUtils';

import {
  Button,
  ConfirmDialog,
  EmptyState,
  Loader,
  Notice,
  SectionHeader,
  TextInput,
  useMinLoad,
  useMutationRunner,
} from '@ui/index';

import { ArchiveCard, RetentionCard } from './partials';
import { totalsOf } from './utils/archiveTotalsUtils';

import type { AsyncResource } from '@features/history-data';
import type { RetentionStatusResponse } from '@lib/apis/contracts';
import type { ArchivedSession, ArchiveSummary } from '@services/archive/archiveService';
import type { ProjectSummary } from '@services/history/historyService';
import type { FC } from 'react';

export interface ArchiveViewProps {
  readonly archives: AsyncResource<readonly ArchiveSummary[]>;
  readonly retention: AsyncResource<RetentionStatusResponse>;
  readonly nowMs: number;
  readonly onOpenSession: (session: ArchivedSession) => void;
  /**
   * The sidebar's selected project, if any: the list narrows to archives
   * holding one of its sessions, and each card to those sessions. Retention
   * and Create archive stay machine-wide either way.
   */
  readonly selectedProject?: ProjectSummary | null;
  readonly onShowAll?: () => void;
}

export const ArchiveView: FC<ArchiveViewProps> = ({
  archives,
  retention,
  nowMs,
  onOpenSession,
  selectedProject = null,
  onShowAll,
}) => {
  const { t } = useTranslation('archive');
  const [note, setNote] = useState('');
  const mutation = useMutationRunner();
  const [pendingDelete, setPendingDelete] = useState<ArchiveSummary>();
  const projectKey = selectedProject == null
    ? undefined
    : projectKeyOf(selectedProject.agent, selectedProject.id);
  const list = (archives.data ?? []).filter((archive) => {
    return projectKey == null || archive.projectKeys.includes(projectKey);
  });
  const totals = totalsOf(list);
  const reload = archives.reload;
  const waiting = useMinLoad(archives.status === 'loading');

  const runCreate = (): void => {
    void mutation.run(async () => {
      await createArchive({ note });
      setNote('');
      reload();
    });
  };

  const runDelete = (archive: ArchiveSummary): void => {
    setPendingDelete(undefined);
    void mutation.run(async () => {
      await deleteArchive({ id: archive.id });
      reload();
    });
  };

  if (waiting) {
    return (
      <div className="flex h-full items-center justify-center" data-archive-loading>
        <Loader icon={<Archive className="size-6" />} label={t('loadingArchives')} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4" data-archive-view>
      <div className="grid gap-4">
        {/* The archives are what you came for, so they get the pane. Retention
            is a setting: it keeps one card at the top and then gets out of the
            way. */}
        <RetentionCard retention={retention} nowMs={nowMs} />

        <div className="
          flex flex-wrap items-center gap-2 rounded-lg border border-border
          bg-card p-3
        "
        >
          <TextInput
            value={note}
            onInput={setNote}
            label={t('noteLabel')}
            placeholder={t('notePlaceholder')}
            disabled={mutation.busy}
            className="min-w-48 flex-1"
          />
          <Button variant="primary" disabled={mutation.busy} onClick={runCreate}>
            {mutation.busy
              ? <Loader2 className="size-3.5 animate-spin" />
              : (
                  <Plus className="size-3.5" />
                )}
            {mutation.busy ? t('creating') : t('createArchive')}
          </Button>
        </div>

        {mutation.error.length > 0 && (
          <Notice>{mutation.error}</Notice>
        )}

        {/* Three figures that read 0, 0 and 0B on an empty install were three
            full-size cards saying nothing happened. They ride the header of the
            list they summarise instead. */}
        <SectionHeader
          icon={<Archive className="size-3.5" />}
          label={t('panelArchives')}
          action={(
            <span className="
              flex flex-wrap items-center gap-3 text-figure text-faint
            "
            >
              {selectedProject != null && (
                <span className="flex items-center gap-2" data-archive-scope>
                  <span className="text-foreground-2">
                    {t('scopedTo', { project: selectedProject.name })}
                  </span>
                  <Button size="sm" variant="ghost" onClick={onShowAll}>
                    {t('showAll')}
                  </Button>
                </span>
              )}
              <span>
                <span className="font-mono text-foreground-2">{list.length}</span>
                {' '}
                {t('archiveCount')}
              </span>
              <span>
                <span className="font-mono text-foreground-2">{totals.sessions}</span>
                {' '}
                {t('sessionsSaved')}
              </span>
              <span>
                <span className="font-mono text-foreground-2">{sizeLabel(totals.bytes)}</span>
                {' '}
                {t('spaceUsed')}
              </span>
            </span>
          )}
        />

        {archives.status === 'ready' && list.length === 0 && (
          <EmptyState
            icon={<Archive className="size-8" />}
            title={t('noArchives')}
            hint={selectedProject == null
              ? t('noArchivesHint')
              : t('noArchivesForProject', { project: selectedProject.name })}
          />
        )}

        <div className="grid gap-2">
          {list.map((archive) => {
            return (
              <ArchiveCard
                key={archive.id}
                archive={archive}
                projectKey={projectKey}
                onOpenSession={onOpenSession}
                onDelete={(target) => {
                  setPendingDelete(target);
                }}
              />
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete != null}
        icon={<CircleAlert className="size-4 text-destructive" />}
        heading={t('deleteArchive')}
        description={<p className="mt-2 text-sm text-muted-foreground">{t('deleteArchiveWarning')}</p>}
        confirmLabel={t('deleteArchive')}
        onClose={() => {
          setPendingDelete(undefined);
        }}
        onConfirm={pendingDelete == null
          ? undefined
          : () => {
              runDelete(pendingDelete);
            }}
      />
    </div>
  );
};
