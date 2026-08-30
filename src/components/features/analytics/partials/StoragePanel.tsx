import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CircleAlert,
  HardDrive,
  Trash2,
} from 'lucide-react';

import { reclaimStorage } from '@lib/apis/apiClient';
import { sizeLabel } from '@utils/formatUtils';

import {
  BarRow,
  Button,
  ConfirmDialog,
  EmptyState,
  MetricCard,
  Spinner,
} from '@ui/index';

import type { AsyncResource } from '@features/history-data';
import type { StorageReport } from '@services/storage/storageService';
import type { FC } from 'react';

export interface StoragePanelProps {
  readonly storage: AsyncResource<StorageReport>;
}

export const StoragePanel: FC<StoragePanelProps> = ({ storage }) => {
  const { t } = useTranslation('analytics');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const report = storage.data;
  const disposable = (report?.agents ?? []).flatMap((agent) => {
    return agent.entries.filter((entry) => {
      return entry.reclaimable;
    });
  });

  const freeThem = (): void => {
    setBusy(true);

    void (async (): Promise<void> => {
      try {
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
      }
      catch {
        setNotice(t('reclaimFailed'));
      }
      finally {
        setBusy(false);
        setAsking(false);
      }
    })();
  };

  return (
    <div className="grid gap-3" data-storage-panel>
      <p className="text-sm text-muted-foreground">{t('storageIntro')}</p>

      {storage.status === 'loading' && <Spinner />}

      {storage.status === 'error' && (
        <p className="
          flex items-center gap-2 rounded-lg border border-destructive/40
          bg-destructive/10 px-3 py-2 text-xs text-destructive
        "
        >
          <CircleAlert className="size-3.5" />
          {storage.error}
        </p>
      )}

      {report != null && (
        <>
          <div className="
            grid gap-3
            sm:grid-cols-2
          "
          >
            <MetricCard
              label={t('storageTotal')}
              value={sizeLabel(report.totalBytes)}
              hint={report.partial ? t('storagePartial') : undefined}
              icon={<HardDrive className="size-3.5" />}
            />
            <MetricCard label={t('storageAgents')} value={String(report.agents.length)} />
          </div>

          {disposable.length > 0 && (
            <div className="
              flex flex-wrap items-center justify-between gap-2 rounded-xl
              border border-border bg-card p-3
            "
            >
              <p className="text-xs text-muted-foreground">
                {t('reclaimAvailable', { size: sizeLabel(report.reclaimableBytes) })}
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

          {report.agents.length === 0
            ? <EmptyState icon={<HardDrive className="size-8" />} title={t('storageNone')} />
            : (
                <ul className="grid gap-3">
                  {report.agents.map((agent) => {
                    return (
                      <li
                        key={agent.agent}
                        className="
                          grid gap-1.5 rounded-xl border border-border bg-card
                          p-3
                        "
                      >
                        <BarRow
                          label={agent.label}
                          max={report.totalBytes}
                          value={agent.bytes}
                          formatValue={sizeLabel}
                        />
                        <ul className="grid gap-0.5 ps-2">
                          {agent.entries.map((entry) => {
                            return (
                              <li
                                key={entry.path}
                                className="
                                  flex items-center gap-2 text-[11px]
                                  text-muted-foreground
                                "
                              >
                                <span
                                  className="min-w-0 flex-1 truncate font-mono"
                                  title={entry.path}
                                >
                                  {entry.name}
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

          <p className="text-[11px] text-muted-foreground">{t('storageReadOnly')}</p>
        </>
      )}

      <ConfirmDialog
        open={asking}
        labelledBy="reclaim-storage"
        icon={<Trash2 className="size-4 text-destructive" />}
        heading={t('reclaimHeading')}
        confirmLabel={t('reclaimConfirm')}
        busyLabel={t('reclaimBusy')}
        busy={busy}
        onClose={() => {
          setAsking(false);
        }}
        onConfirm={freeThem}
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
