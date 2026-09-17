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
        flex items-center gap-3 border-b border-border bg-accent px-3 py-1.5
        text-xs
      "
      data-update-banner
    >
      <Download className="size-3.5 text-primary" />
      <span className="flex-1">
        {stage === 'downloading' ? t('downloading') : t('available', { version })}
      </span>
      {stage === 'available' && install != null && (
        <Button size="sm" variant="ghost" onClick={install}>
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
