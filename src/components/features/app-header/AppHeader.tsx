import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  History,
  RefreshCw,
  Search,
  Settings,
} from 'lucide-react';

import { cn } from '@utils/cnUtils';

import { Button, Toast } from '@ui/index';

import type { FC } from 'react';

export type AppView = 'sessions' | 'analytics' | 'health' | 'archive';

export interface AppHeaderProps {
  readonly onOpenSearch: () => void;
  readonly onReload: () => void;
  readonly onOpenSettings: () => void;
}

export const AppHeader: FC<AppHeaderProps> = ({
  onOpenSearch,
  onReload,
  onOpenSettings,
}) => {
  const { t } = useTranslation('common');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!refreshing) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setRefreshing(false);
    }, 3000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [refreshing]);

  return (
    <>
      <header
        className="
          flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card
          px-3
        "
        data-app-header
      >
        <div className="flex items-center gap-2">
          <span className="
            flex size-7 items-center justify-center rounded-lg bg-primary
            text-primary-foreground shadow-sm ring-1 shadow-black/20
            ring-primary-foreground/20
          "
          >
            <History className="size-4" />
          </span>
          <h1 className="
            text-sm font-semibold tracking-[-0.02em] text-foreground
          "
          >
            AI Manager
          </h1>
        </div>

        <div className="ms-auto flex items-center gap-0.5">
          <Button size="sm" variant="ghost" onClick={onOpenSearch} title={t('searchAllChats')}>
            <Search className="size-3.5" />
            {t('searchAllChatsLabel')}
            <kbd className="
              ms-1 rounded-sm border border-border px-1 font-mono text-figure
              text-muted-foreground
            "
            >
              /
            </kbd>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              onReload();
            }}
            title={refreshing ? t('refreshing') : t('refresh')}
          >
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenSettings} title={t('navSettings')}>
            <Settings className="size-3.5" />
          </Button>
        </div>
      </header>
      <Toast message={refreshing ? t('refreshingToast') : null} />
    </>
  );
};
