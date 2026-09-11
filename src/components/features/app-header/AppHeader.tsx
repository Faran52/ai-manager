import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  RefreshCw,
  Search,
  Settings,
} from 'lucide-react';

import { cn } from '@utils/cnUtils';

import { Tooltip, useToast } from '@ui/index';

import type { FC } from 'react';

export type AppView = 'sessions' | 'analytics' | 'health' | 'archive';

export interface AppHeaderProps {
  readonly onOpenSearch: () => void;
  readonly onReload: () => void;
  readonly onOpenSettings: () => void;
}

/**
 * The titlebar: what the window is. A centred search field, and refresh and
 * settings as icons on the trailing edge. The window carries no wordmark; on the
 * desktop the OS draws the frame, and in the browser there is none to draw.
 */
export const AppHeader: FC<AppHeaderProps> = ({
  onOpenSearch,
  onReload,
  onOpenSettings,
}) => {
  const { t } = useTranslation('common');
  const { push } = useToast();
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
    <header className="titlebar" data-app-header>
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label={t('searchAllChats')}
        className="titlebar-search"
      >
        <Search className="size-3" />
        {t('searchPlaceholder')}
        <kbd className="
          ms-1 rounded-xs border border-border px-1 font-mono text-eyebrow
          text-faint
        "
        >
          /
        </kbd>
      </button>

      <div className="ms-auto flex items-center gap-1">
        <Tooltip content={refreshing ? t('refreshing') : t('refresh')}>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              onReload();
              push(t('refreshingToast'));
            }}
            aria-label={refreshing ? t('refreshing') : t('refresh')}
            className="chrome-icon-button"
          >
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
          </button>
        </Tooltip>
        <Tooltip content={t('navSettings')}>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t('navSettings')}
            className="chrome-icon-button"
          >
            <Settings className="size-3.5" />
          </button>
        </Tooltip>
      </div>
    </header>
  );
};
