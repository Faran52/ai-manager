import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  PatchView,
  Spinner,
} from '@ui/index';
import { useFileHistory } from '@features/history-data';

import type { FC } from 'react';

export interface FileDiffPanelProps {
  readonly sessionId: string;
  readonly path: string;
}

export const FileDiffPanel: FC<FileDiffPanelProps> = ({ sessionId, path }) => {
  const { t } = useTranslation('board');
  const [version, setVersion] = useState<number>();
  const snapshot = useFileHistory({
    sessionId,
    path,
    version,
  });

  if (snapshot.status === 'loading') {
    return (
      <div className="flex justify-center py-3">
        <Spinner />
      </div>
    );
  }

  const versions = snapshot.data?.history.versions ?? [];
  const diff = snapshot.data?.diff;

  if (versions.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground" data-file-diff-empty>
        {snapshot.status === 'error' ? t('diffFailed') : t('noSnapshots')}
      </p>
    );
  }

  return (
    <div className="grid gap-2" data-file-diff>
      <div className="flex flex-wrap items-center gap-1">
        {versions.map((entry) => {
          const shown = diff?.version === entry.version;

          return (
            <Button
              key={entry.version}
              size="sm"
              variant={shown ? 'primary' : 'ghost'}
              pressed={shown}
              onClick={() => {
                setVersion(entry.version);
              }}
            >
              {t('versionLabel', { version: entry.version })}
            </Button>
          );
        })}
      </div>

      {diff?.firstRecorded === true && (
        <p className="text-[11px] text-muted-foreground">{t('firstSnapshot')}</p>
      )}

      {diff != null && diff.hunks.length > 0
        ? <PatchView hunks={diff.hunks} />
        : (
            <p className="text-[11px] text-muted-foreground" data-file-diff-unchanged>
              {t('noChangeRecorded')}
            </p>
          )}
    </div>
  );
};
