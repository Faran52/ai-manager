import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Archive,
  FolderClosed,
  Loader2,
  Search,
} from 'lucide-react';

import { toErrorMessage } from '@utils/errorUtils';

import { SegmentedControl } from '@ui/index';

import type { Scope } from '@features/analytics';
import type { FC, ReactNode } from 'react';

export type AppView = 'sessions' | 'analytics' | 'health' | 'archive';

export interface AppHeaderProps {
  readonly view: AppView;
  // The project the columns are scoped to, or null for the whole machine.
  readonly projectName: string | null;
  readonly scope: Scope;
  readonly onScopeChange: (scope: Scope) => void;
  readonly onOpenSearch: () => void;
  // Archives the open transcript; null when there is none to archive.
  readonly onArchiveSession: (() => Promise<void>)
    | null;
  readonly onNotice: (message: string) => void;
  // A promoted control for the open thing, shown before Archive (Copy markdown).
  readonly actions?: ReactNode;
  // The overflow menu, shown after Archive, for the less-used actions.
  readonly overflow?: ReactNode;
}

/**
 * The one bar of window chrome: what you are looking at on the left, search
 * in the centre, what you can do to the open thing on the right. Refresh and
 * settings live at the foot of the rail. The window carries no wordmark; on
 * the desktop the OS draws the frame, and in the browser there is none to draw.
 */
export const AppHeader: FC<AppHeaderProps> = ({
  view,
  projectName,
  scope,
  onScopeChange,
  onOpenSearch,
  onArchiveSession,
  onNotice,
  actions,
  overflow,
}) => {
  const { t } = useTranslation('common');
  const [busy, setBusy] = useState(false);

  const runArchive = (archive: () => Promise<void>): void => {
    setBusy(true);
    void (async (): Promise<void> => {
      try {
        await archive();
      }
      catch (cause) {
        onNotice(toErrorMessage(cause));
      }
      finally {
        setBusy(false);
      }
    })();
  };

  return (
    <header className="titlebar" data-app-header>
      {view === 'analytics' && projectName != null
        ? (
            <SegmentedControl
              label={t('analyticsScope')}
              value={scope}
              onChange={onScopeChange}
              options={[
                {
                  value: 'global',
                  label: t('scopeGlobal'),
                },
                {
                  value: 'project',
                  label: projectName,
                },
              ]}
            />
          )
        : (
            <span className="context-chip">
              <FolderClosed className="size-3" />
              <span className="max-w-40 truncate">
                {view === 'analytics' && scope === 'global'
                  ? t('scopeGlobal')
                  : projectName ?? t('allProjects')}
              </span>
            </span>
          )}

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

      <div className="ms-auto flex shrink-0 items-center gap-1">
        {actions}
        {onArchiveSession != null && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              runArchive(onArchiveSession);
            }}
            className="command-action"
          >
            {busy
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Archive className="size-3.5" />}
            {t('archiveAction')}
          </button>
        )}
        {overflow}
      </div>
    </header>
  );
};
