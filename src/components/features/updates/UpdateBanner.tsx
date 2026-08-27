import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Download } from 'lucide-react';

import { fetchUpdateCheck } from '@lib/apis/apiClient';

import { Button } from '@ui/index';

import type { FC } from 'react';

export const UpdateBanner: FC = () => {
  const { t } = useTranslation('update');
  const [version, setVersion] = useState<string | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;

    const check = async (): Promise<void> => {
      try {
        const response = await fetchUpdateCheck();

        if (active && response.update.stage === 'available') {
          setVersion(response.update.version);
        }
      }
      catch {
        // A failed check is not worth interrupting anyone over.
      }
    };

    void check();

    return () => {
      active = false;
    };
  }, []);

  if (version == null || dismissed) {
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
