import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  BarChart3,
  HeartPulse,
  History,
  RefreshCw,
  Search,
} from 'lucide-react';

import { cn } from '@utils/cnUtils';

import { Button, Toast } from '@ui/index';
import { LanguagePicker } from '@features/language';
import { AccentPicker, ThemePicker } from '@features/theme';

import type { ThemeMode } from '@features/theme';
import type { FC } from 'react';

export type AppView = 'sessions' | 'analytics' | 'health';

export interface AppHeaderProps {
  readonly view: AppView;
  readonly onViewChange: (view: AppView) => void;
  readonly onOpenSearch: () => void;
  readonly onReload: () => void;
  readonly themeMode: ThemeMode;
  readonly onThemeChange: (mode: ThemeMode) => void;
}

export const AppHeader: FC<AppHeaderProps> = ({
  view,
  onViewChange,
  onOpenSearch,
  onReload,
  themeMode,
  onThemeChange,
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
            AI Chat Manager
          </h1>
        </div>

        <nav
          className="ms-3 flex items-center gap-1 rounded-lg bg-muted p-0.5"
          aria-label={t('navSessions')}
        >
          <Button
            size="sm"
            variant={view === 'sessions' ? 'primary' : 'ghost'}
            onClick={() => {
              onViewChange('sessions');
            }}
            pressed={view === 'sessions'}
          >
            {t('navSessions')}
          </Button>
          <Button
            size="sm"
            variant={view === 'analytics' ? 'primary' : 'ghost'}
            onClick={() => {
              onViewChange('analytics');
            }}
            pressed={view === 'analytics'}
          >
            <BarChart3 className="size-3.5" />
            {t('navAnalytics')}
          </Button>
          <Button
            size="sm"
            variant={view === 'health' ? 'primary' : 'ghost'}
            onClick={() => {
              onViewChange('health');
            }}
            pressed={view === 'health'}
          >
            <HeartPulse className="size-3.5" />
            {t('navHealth')}
          </Button>
        </nav>

        <div className="ms-auto flex items-center gap-0.5">
          <Button size="sm" variant="ghost" onClick={onOpenSearch} title={t('searchAllChats')}>
            <Search className="size-3.5" />
            {t('searchAllChatsLabel')}
            <kbd className="
              ms-1 rounded-sm border border-border px-1 font-mono text-[10px]
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
          <AccentPicker />
          <LanguagePicker />
          <ThemePicker mode={themeMode} onChange={onThemeChange} />
        </div>
      </header>
      <Toast message={refreshing ? t('refreshingToast') : null} />
    </>
  );
};
