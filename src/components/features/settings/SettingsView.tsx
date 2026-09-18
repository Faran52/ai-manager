import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SlidersHorizontal } from 'lucide-react';

import { projectScopedSettingsAgents } from '@config/agents';

import { writeSettings } from '@lib/apis/apiClient';

import {
  EmptyState,
  Notice,
  Spinner,
  useMutationRunner,
} from '@ui/index';

import {
  EditableScopeCard,
  ReadOnlyScopeCard,
  ScopeTabs,
} from './partials';
import { draftOf } from './utils/settingsDraftUtils';

import type { AgentId } from '@config/agents';
import type { AsyncResource } from '@features/history-data';
import type { ScopeSettings, SettingsScope } from '@services/settings/settingsService';
import type { FC } from 'react';
import type { Draft } from './utils/settingsDraftUtils';

export interface SettingsViewProps {
  readonly settings: AsyncResource<readonly ScopeSettings[]>;
  readonly projectPath: string | null;
  readonly agent: AgentId;
  // Which Claude profile is being edited, so a save lands in that root.
  readonly profile?: string | undefined;
}

export const SettingsView: FC<SettingsViewProps> = ({
  settings,
  projectPath,
  agent,
  profile,
}) => {
  const { t } = useTranslation('settings');
  const scopes = settings.data ?? [];
  const [active, setActive] = useState<SettingsScope>('user');
  // Keyed by path, so switching scope parks an edit rather than discarding it. A
  // key present is the definition of unsaved, dropped once the file has it.
  const [drafts, setDrafts] = useState<Readonly<Record<string, Draft>>>({});
  const mutation = useMutationRunner();
  const [savedPath, setSavedPath] = useState<string>();
  const current = scopes.find((scope) => {
    return scope.scope === active;
  });
  const reload = settings.reload;

  const draft = current == null ? undefined : drafts[current.path] ?? draftOf(current);
  const dirty = current != null && drafts[current.path] != null;
  const saved = current != null && savedPath === current.path && !dirty;

  // Both take the draft rather than reading it: they are only reachable from the
  // block below, where it is known to exist, so neither needs a null branch.
  const patch = (path: string, base: Draft, next: Partial<Draft>): void => {
    setDrafts({
      ...drafts,
      [path]: {
        ...base,
        ...next,
      },
    });
  };

  const save = (path: string, value: Draft): void => {
    void mutation.run(async () => {
      await writeSettings({
        projectPath: projectPath ?? '',
        scope: active,
        patch: value,
        agent,
        profile,
      });
      setDrafts(Object.fromEntries(Object.entries(drafts).filter(([key]) => {
        return key !== path;
      })));
      setSavedPath(path);
      reload();
    });
  };

  return (
    // The heading and the file tabs stay put; only the file's own content
    // scrolls, so the tab you are on never leaves the top of the sheet.
    <div className="flex h-full flex-col" data-settings-view>
      <div className="mx-auto grid w-full max-w-3xl gap-4 px-4 pt-4">
        <header className="grid gap-1">
          <h2 className="text-base font-semibold text-foreground">{t('heading')}</h2>
          <p className="text-sm text-muted-foreground">{t('intro')}</p>
        </header>

        <ScopeTabs
          scopes={scopes}
          active={active}
          drafts={drafts}
          onSelect={(scope) => {
            setActive(scope);
            mutation.clear();
          }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-3xl gap-4">
          {settings.status === 'loading' && (
            <div className="flex justify-center py-8" data-settings-loading>
              <Spinner />
            </div>
          )}

          {settings.status === 'error' && (
            <Notice>{settings.error}</Notice>
          )}

          {settings.status === 'ready' && scopes.length === 1
            && projectScopedSettingsAgents.includes(agent) && (
            <p className="text-xs text-muted-foreground" data-settings-project-hint>
              {t('projectHint')}
            </p>
          )}

          {current == null && settings.status === 'ready' && (
            <EmptyState
              icon={<SlidersHorizontal />}
              title={scopes.length === 0 ? t('noSettingsFile') : t('noScope')}
            />
          )}

          {current != null && current.editable !== true && (
            <ReadOnlyScopeCard scope={current} />
          )}

          {current?.editable === true && draft != null && (
            <EditableScopeCard
              scope={current}
              draft={draft}
              mutation={mutation}
              dirty={dirty}
              saved={saved}
              onPatch={(next) => {
                patch(current.path, draft, next);
              }}
              onSave={() => {
                save(current.path, draft);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
