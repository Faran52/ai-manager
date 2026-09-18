import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Download } from 'lucide-react';

import { Button } from '@ui/index';

import { useUpdateProbe } from './hooks/useUpdateProbe';

import type { FC } from 'react';

/*
 * The launch check, the only one the reader never asks for. Nothing but an
 * available version puts a row on screen, so a failure stays silent.
 */
export const UpdateBanner: FC = () => {
  const { t } = useTranslation('update');
  const {
    stage,
    version,
    check,
    install,
  } = useUpdateProbe();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    check();
  }, [check]);

  // The row stays while the download runs: it is what says the download is on.
  if (dismissed || (stage !== 'available' && stage !== 'downloading')) {
    return null;
  }

  return (
    <div
      className="
        flex items-center gap-2 border-b border-border bg-primary/10 px-3 py-1.5
        text-xs text-foreground-2
      "
      data-update-banner
    >
      <Download className="size-3.5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate">
        {stage === 'downloading' ? t('downloading') : t('available', { version })}
      </span>
      {stage === 'available' && install != null && (
        <Button size="sm" variant="primary" onClick={install}>
          {t('install')}
        </Button>
      )}
      {stage === 'available' && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDismissed(true);
          }}
        >
          {t('later')}
        </Button>
      )}
    </div>
  );
};
