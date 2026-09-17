import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Download } from 'lucide-react';

import { Button } from '@ui/index';

import { useUpdateProbe } from './hooks/useUpdateProbe';

import type { FC } from 'react';

/*
 * The launch check, the only one the reader never asks for. A failed check is
 * not worth interrupting anyone over, and nothing but an available version
 * puts a row on screen, so a browser with no updater to ask shows nothing.
 */
export const UpdateBanner: FC = () => {
  const { t } = useTranslation('update');
  const {
    stage,
    version,
    check,
  } = useUpdateProbe();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    check();
  }, [check]);

  if (stage !== 'available' || dismissed) {
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
      <span className="flex-1">{t('available', { version })}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setDismissed(true);
        }}
      >
        {t('later')}
      </Button>
    </div>
  );
};
