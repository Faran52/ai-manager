import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Archive,
  FolderClosed,
  Loader2,
} from 'lucide-react';

import { toErrorMessage } from '@utils/errorUtils';

import { SegmentedControl } from '@ui/index';

import type { Scope } from '@features/analytics';
import type { FC, ReactNode } from 'react';
import type { AppView } from './AppHeader';

export interface CommandBarProps {
  readonly view: AppView;
  // The project the columns are scoped to, or null for the whole machine.
  readonly projectName: string | null;
  readonly scope: Scope;
  readonly onScopeChange: (scope: Scope) => void;
  // Archives the open transcript; null when there is none to archive.
  readonly onArchiveSession: (() => Promise<void>)
    | null;
  readonly onNotice: (message: string) => void;
  // A promoted control for the open thing, shown before Archive (Copy markdown).
  readonly actions?: ReactNode;
  // The overflow menu, shown after Archive, for the less-used actions.
  readonly overflow?: ReactNode;
}

// The bar under the titlebar: what you are looking at reads on the left, what
// you can do to it reads on the right, and never the reverse.
export const CommandBar: FC<CommandBarProps> = ({
  view,
  projectName,
  scope,
  onScopeChange,
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
    <div className="command-bar" data-command-bar>
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
    </div>
  );
};
