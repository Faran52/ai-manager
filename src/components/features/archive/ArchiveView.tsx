import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Archive,
  CircleAlert,
  HardDrive,
  Loader2,
  Plus,
} from 'lucide-react';

import { createArchive, deleteArchive } from '@lib/apis/apiClient';
import { toErrorMessage } from '@utils/errorUtils';
import { sizeLabel } from '@utils/formatUtils';

import {
  Button,
  ConfirmDialog,
  EmptyState,
  MetricCard,
  Spinner,
  TextInput,
} from '@ui/index';

import {
  ArchiveCard,
  PromptHistoryPanel,
  RetentionCard,
  StoragePanel,
} from './partials';

import type { AsyncResource } from '@features/history-data';
import type { RetentionStatusResponse } from '@lib/apis/contracts';
import type { ArchivedSession, ArchiveSummary } from '@services/archive/archiveService';
import type { PromptHistory } from '@services/prompts/promptsService';
import type { StorageReport } from '@services/storage/storageService';
import type { FC } from 'react';

export type ArchivePanel = 'archives' | 'prompts' | 'storage';

export interface ArchiveViewProps {
  readonly archives: AsyncResource<readonly ArchiveSummary[]>;
  readonly prompts: AsyncResource<PromptHistory>;
  readonly retention: AsyncResource<RetentionStatusResponse>;
  readonly storage: AsyncResource<StorageReport>;
  readonly nowMs: number;
  readonly onOpenSession: (session: ArchivedSession) => void;
  readonly onOpenPrompt: (filePath: string, timestampMs: number) => void;
}

const PANELS: readonly ArchivePanel[] = ['archives', 'prompts', 'storage'];

// Keys, not text, the map lives outside the component where t is unavailable.
const PANEL_LABELS: Record<ArchivePanel, string> = {
  archives: 'panelArchives',
  prompts: 'panelPrompts',
  storage: 'panelStorage',
};

const totalsOf = (archives: readonly ArchiveSummary[]): {
  readonly sessions: number;
  readonly bytes: number;
} => {
  return archives.reduce((totals, archive) => {
    return {
      sessions: totals.sessions + archive.sessionCount,
      bytes: totals.bytes + archive.sizeBytes,
    };
  }, {
    sessions: 0,
    bytes: 0,
  });
};

export const ArchiveView: FC<ArchiveViewProps> = ({
  archives,
  prompts,
  retention,
  storage,
  nowMs,
  onOpenSession,
  onOpenPrompt,
}) => {
  const { t } = useTranslation('archive');
  const [panel, setPanel] = useState<ArchivePanel>('archives');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [pendingDelete, setPendingDelete] = useState<ArchiveSummary>();
  const list = archives.data ?? [];
  const totals = totalsOf(list);
  const reload = archives.reload;

  const runCreate = (): void => {
    setBusy(true);
    setError(undefined);
    void (async (): Promise<void> => {
      try {
        await createArchive({ note });
        setNote('');
        reload();
      }
      catch (cause) {
        setError(toErrorMessage(cause));
      }
      finally {
        setBusy(false);
      }
    })();
  };

  const runDelete = (archive: ArchiveSummary): void => {
    setPendingDelete(undefined);
    setBusy(true);
    void (async (): Promise<void> => {
      try {
        await deleteArchive({ id: archive.id });
        reload();
      }
      catch (cause) {
        setError(toErrorMessage(cause));
      }
      finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="h-full overflow-y-auto p-4" data-archive-view>
      <div className="mx-auto grid max-w-4xl gap-4">
        <header className="grid gap-1">
          <h2 className="text-base font-semibold text-foreground">{t('heading')}</h2>
        </header>

        <nav className="flex w-fit items-center gap-1 rounded-lg bg-muted p-0.5" aria-label={t('panels')}>
          {PANELS.map((name) => {
            return (
              <Button
                key={name}
                size="sm"
                variant={name === panel ? 'primary' : 'ghost'}
                pressed={name === panel}
                onClick={() => {
                  setPanel(name);
                }}
              >
                {t(PANEL_LABELS[name])}
              </Button>
            );
          })}
        </nav>

        {panel === 'storage' && <StoragePanel storage={storage} />}

        {panel === 'prompts' && (
          <PromptHistoryPanel history={prompts} nowMs={nowMs} onOpenPrompt={onOpenPrompt} />
        )}

        {panel === 'archives' && (
          <>
            <p className="text-sm text-muted-foreground">{t('intro')}</p>

            <RetentionCard retention={retention} nowMs={nowMs} />

            <div className="
              grid gap-3
              sm:grid-cols-3
            "
            >
              <MetricCard
                label={t('archiveCount')}
                value={String(list.length)}
                icon={<Archive className="size-3.5" />}
              />
              <MetricCard
                label={t('sessionsSaved')}
                value={String(totals.sessions)}
              />
              <MetricCard
                label={t('spaceUsed')}
                value={sizeLabel(totals.bytes)}
                icon={<HardDrive className="size-3.5" />}
              />
            </div>

            <div className="
              flex flex-wrap items-center gap-2 rounded-xl border border-border
              bg-card p-3
            "
            >
              <TextInput
                value={note}
                onInput={setNote}
                label={t('noteLabel')}
                placeholder={t('notePlaceholder')}
                disabled={busy}
                className="min-w-48 flex-1"
              />
              <Button variant="primary" disabled={busy} onClick={runCreate}>
                {busy
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : (
                      <Plus className="size-3.5" />
                    )}
                {busy ? t('creating') : t('createArchive')}
              </Button>
            </div>

            {error != null && (
              <p className="
                flex items-center gap-2 rounded-lg border border-destructive/40
                bg-destructive/10 px-3 py-2 text-xs text-destructive
              "
              >
                <CircleAlert className="size-3.5" />
                {error}
              </p>
            )}

            {archives.status === 'loading' && <Spinner />}

            {archives.status === 'ready' && list.length === 0 && (
              <EmptyState
                icon={<Archive className="size-8" />}
                title={t('noArchives')}
                hint={t('noArchivesHint')}
              />
            )}

            <div className="grid gap-2">
              {list.map((archive) => {
                return (
                  <ArchiveCard
                    key={archive.id}
                    archive={archive}
                    onOpenSession={onOpenSession}
                    onDelete={(target) => {
                      setPendingDelete(target);
                    }}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete != null}
        labelledBy="archive-delete-heading"
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
