import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { sumBy } from 'es-toolkit';
import { HardDrive, Trash2 } from 'lucide-react';

import { reclaimStorage } from '@lib/apis/apiClient';
import { sizeLabel } from '@utils/formatUtils';

import {
  BarRow,
  Button,
  ConfirmDialog,
  EmptyState,
  MetricCard,
  Notice,
  Spinner,
  useMutationRunner,
} from '@ui/index';

import { entryLabel, heldBy } from '../utils/storageHeldUtils';

import type { AgentId } from '@config/agents';
import type { AsyncResource } from '@features/history-data';
import type { SessionSummary } from '@services/history/historyService';
import type { StorageReport } from '@services/storage/storageService';
import type { FC } from 'react';

export interface StoragePanelProps {
  readonly storage: AsyncResource<StorageReport>;
  // Naming an agent narrows the report to what that agent alone is holding.
  readonly agent?: AgentId | undefined;
  /*
   * A project's own transcripts, the only part of an agent's storage that belongs
   * to one project. Plugins, caches and logs are shared by every project.
   */
  readonly projectSessions?: readonly SessionSummary[] | undefined;
}

export const StoragePanel: FC<StoragePanelProps> = ({
  storage,
  agent,
  projectSessions,
}) => {
  const { t } = useTranslation('analytics');
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState<string>();
  const mutation = useMutationRunner(() => {
    setNotice(t('reclaimFailed'));
  });
  const report = storage.data;
  const {
    shown,
    totalBytes,
    reclaimableBytes,
    disposable,
  } = heldBy(report, agent);
  const projectBytes = sumBy(projectSessions ?? [], (session) => {
    return session.sizeBytes;
  });
  const onlyThisProject = projectSessions != null;

  const freeThem = async (): Promise<void> => {
    await mutation.run(async () => {
      const { result } = await reclaimStorage({
        paths: disposable.map((entry) => {
          return entry.path;
        }),
      });

      setNotice(t('reclaimFreed', {
        count: result.removed.length,
        size: sizeLabel(result.freedBytes),
      }));
      storage.reload();
    });
    setAsking(false);
  };

  const partialHint = report?.partial === true ? t('storagePartial') : undefined;

  return (
    <div className="grid gap-3" data-storage-panel>
      <p className="text-sm text-muted-foreground">{t('storageIntro')}</p>

      {storage.status === 'loading' && (
        <div className="flex justify-center py-6" data-storage-loading>
          <Spinner />
        </div>
      )}

      {storage.status === 'error' && (
        <Notice>{storage.error}</Notice>
      )}

      {report != null && (
        <>
          <div className="
            grid gap-3
            sm:grid-cols-2
          "
          >
            <MetricCard
              label={onlyThisProject ? t('storageProject') : t('storageTotal')}
              value={sizeLabel(onlyThisProject ? projectBytes : totalBytes)}
              hint={onlyThisProject
                ? t('storageProjectHint', { count: projectSessions.length })
                : partialHint}
              icon={<HardDrive className="size-3.5" />}
            />
            <MetricCard
              label={onlyThisProject ? t('storageAgentTotal') : t('storageAgents')}
              value={onlyThisProject ? sizeLabel(totalBytes) : String(shown.length)}
              hint={onlyThisProject ? t('storageAgentShared') : undefined}
            />
          </div>

          {disposable.length > 0 && !onlyThisProject && (
            <div className="
              flex flex-wrap items-center justify-between gap-2 rounded-lg
              border border-border bg-card p-3
            "
            >
              <p className="text-xs text-muted-foreground">
                {t('reclaimAvailable', { size: sizeLabel(reclaimableBytes) })}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAsking(true);
                }}
              >
                <Trash2 className="size-3.5" />
                {t('reclaimAction')}
              </Button>
            </div>
          )}

          {notice != null && (
            <p className="text-xs text-muted-foreground" data-reclaim-notice>{notice}</p>
          )}

          {shown.length === 0
            ? <EmptyState icon={<HardDrive className="size-8" />} title={t('storageNone')} />
            : (
                <ul className="grid gap-3">
                  {shown.map((held, index) => {
                    return (
                      <li
                        key={held.agent}
                        className="
                          grid gap-1.5 rounded-lg border border-border bg-card
                          p-3
                        "
                      >
                        <ul>
                          <BarRow
                            index={index}
                            label={held.label}
                            max={totalBytes}
                            value={held.bytes}
                            formatValue={sizeLabel}
                          />
                        </ul>
                        <ul className="grid gap-0.5 ps-2">
                          {held.entries.map((entry) => {
                            return (
                              <li
                                key={entry.path}
                                className="
                                  flex items-center gap-2 text-body
                                  text-muted-foreground
                                "
                              >
                                <span
                                  className="min-w-0 flex-1 truncate font-mono"
                                  title={entry.path}
                                >
                                  {entryLabel(entry, held.entries)}
                                </span>
                                <span className="tabular-nums">{sizeLabel(entry.bytes)}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              )}

          <p className="text-body text-muted-foreground">{t('storageReadOnly')}</p>
        </>
      )}

      <ConfirmDialog
        open={asking}
        icon={<Trash2 className="size-4 text-destructive" />}
        heading={t('reclaimHeading')}
        confirmLabel={t('reclaimConfirm')}
        busyLabel={t('reclaimBusy')}
        busy={mutation.busy}
        onClose={() => {
          setAsking(false);
        }}
        onConfirm={() => {
          void freeThem();
        }}
        description={(
          <>
            <p>{t('reclaimExplain')}</p>
            <ul className="mt-2 grid gap-0.5">
              {disposable.map((entry) => {
                return (
                  <li
                    key={entry.path}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono" title={entry.path}>
                      {entry.path}
                    </span>
                    <span className="tabular-nums">{sizeLabel(entry.bytes)}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      />
    </div>
  );
};
