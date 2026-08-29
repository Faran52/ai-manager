import { useTranslation } from 'react-i18next';

import { CircleAlert, HardDrive } from 'lucide-react';

import { sizeLabel } from '@utils/formatUtils';

import {
  BarRow,
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
  const { t } = useTranslation('archive');
  const report = storage.data;

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
    </div>
  );
};
