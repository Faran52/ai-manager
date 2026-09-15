import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Check,
  Loader2,
  Lock,
  Save,
  SlidersHorizontal,
} from 'lucide-react';

import { projectScopedSettingsAgents } from '@config/agents';

import { writeSettings } from '@lib/apis/apiClient';
import { toErrorMessage } from '@utils/errorUtils';

import {
  Button,
  EmptyState,
  Eyebrow,
  Notice,
  Spinner,
} from '@ui/index';

import {
  EnvEditor,
  KeyChips,
  RuleListEditor,
  ScopeTabs,
  SettingsFilePath,
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

// A placeholder each, because one shared example rendered allow, deny and ask
// as the same field repeated three times.
const RULE_LISTS = [
  {
    list: 'allow',
    tone: 'allow',
    placeholder: 'Bash(git status:*)',
  },
  {
    list: 'deny',
    tone: 'deny',
    placeholder: 'Read(./.env)',
  },
  {
    list: 'ask',
    tone: 'ask',
    placeholder: 'Bash(git push:*)',
  },
] as const;

export const SettingsView: FC<SettingsViewProps> = ({
  settings,
  projectPath,
  agent,
  profile,
}) => {
  const { t } = useTranslation('settings');
  const scopes = settings.data ?? [];
  const [active, setActive] = useState<SettingsScope>('user');
  /**
   * Keyed by path, so switching scope parks an edit rather than discarding it.
   * A key present is the definition of unsaved: it is dropped once the file has
   * it, and the scope then reads from the reloaded file again.
   */
  const [drafts, setDrafts] = useState<Readonly<Record<string, Draft>>>({});
  const [saving, setSaving] = useState(false);
  const [savedPath, setSavedPath] = useState<string>();
  const [error, setError] = useState<string>();
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
    setSaving(true);
    setError(undefined);
    void (async (): Promise<void> => {
      try {
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
      }
      catch (cause) {
        setError(toErrorMessage(cause));
      }
      finally {
        setSaving(false);
      }
    })();
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
            setError(undefined);
          }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-3xl gap-4">
          {settings.status === 'loading' && <Spinner />}

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
              icon={<SlidersHorizontal className="size-8" />}
              title={scopes.length === 0 ? t('noSettingsFile') : t('noScope')}
            />
          )}

          {current != null && current.editable !== true && (
            <div className="
              grid gap-3 rounded-lg border border-border bg-card p-4
            "
            >
              <SettingsFilePath scope={current} />
              {/* One quiet line, not a warning banner: nothing has gone wrong. */}
              <p className="
                flex items-start gap-2 text-xs text-muted-foreground
              "
              >
                <Lock className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <span className="font-medium text-foreground">{t('readOnly')}</span>
                  {` ${t('readOnlyHint')}`}
                </span>
              </p>
              <div data-holds>
                {/*
                A file that is not on disk holds nothing by definition, so the
                two together said the same thing twice.
              */}
                {current.preservedKeys.length === 0
                  ? (
                      <p className="text-body text-muted-foreground">
                        {current.exists ? t('holdsNothing') : t('notPresentHint')}
                      </p>
                    )
                  : <KeyChips label={t('holds')} keys={current.preservedKeys} />}
              </div>
            </div>
          )}

          {current?.editable === true && draft != null && (
            <div className="
              grid gap-4 rounded-lg border border-border bg-card p-4
            "
            >
              <SettingsFilePath scope={current} />

              {!current.readable && (
                <Notice tone="warn">{t('unreadable')}</Notice>
              )}

              <Eyebrow size="figure">{t('groupPermissions')}</Eyebrow>
              {RULE_LISTS.map(({
                list,
                tone,
                placeholder,
              }) => {
                return (
                  <RuleListEditor
                    key={list}
                    label={t(`permission_${list}`)}
                    hint={t(`permissionHint_${list}`)}
                    placeholder={placeholder}
                    tone={tone}
                    rules={draft.permissions[list]}
                    onChange={(rules) => {
                      patch(current.path, draft, {
                        permissions: {
                          ...draft.permissions,
                          [list]: rules,
                        },
                      });
                    }}
                  />
                );
              })}

              <Eyebrow size="figure">{t('groupDirectories')}</Eyebrow>
              <RuleListEditor
                label={t('permission_additionalDirectories')}
                hint={t('permissionHint_additionalDirectories')}
                placeholder="../shared-library"
                rules={draft.permissions.additionalDirectories}
                onChange={(rules) => {
                  patch(current.path, draft, {
                    permissions: {
                      ...draft.permissions,
                      additionalDirectories: rules,
                    },
                  });
                }}
              />

              <Eyebrow size="figure">{t('groupEnvironment')}</Eyebrow>
              <EnvEditor
                entries={draft.env}
                onChange={(entries) => {
                  patch(current.path, draft, { env: entries });
                }}
              />

              {/*
              Folded away: sixteen chips of keys this screen will not touch were
              the largest block on the card and the least actionable thing on it.
              A native `details` rather than a state hook, since nothing else
              needs to know whether it is open.
            */}
              {current.preservedKeys.length > 0 && (
                <details data-preserved-keys>
                  <summary className="
                    cursor-pointer text-body text-muted-foreground
                    hover:text-foreground
                  "
                  >
                    {t('preservedCount', { count: current.preservedKeys.length })}
                  </summary>
                  <div className="mt-2">
                    <KeyChips keys={current.preservedKeys} />
                  </div>
                </details>
              )}

              {error != null && (
                <Notice>{error}</Notice>
              )}

              {/*
              Sticky so it stays reachable: four rule lists and the environment
              editor sit above it, and a rule added at the top used to need a
              scroll to the bottom to commit it. -bottom-4 cancels the scroller's
              own pb-4, so the opaque bar reaches the true bottom edge instead of
              leaving a 1rem strip where the row behind it shows through.
            */}
              <div className="
                sticky -bottom-4 -mx-4 -mb-4 flex items-center gap-3
                rounded-b-lg border-t border-border bg-card px-4 py-3
              "
              >
                <Button
                  variant="primary"
                  disabled={saving || !current.readable}
                  onClick={() => {
                    save(current.path, draft);
                  }}
                >
                  {saving && <Loader2 className="size-3.5 animate-spin" />}
                  {!saving && saved && <Check className="size-3.5" />}
                  {!saving && !saved && <Save className="size-3.5" />}
                  {saved && !saving ? t('saved') : t('save')}
                </Button>
                {dirty && !saving && (
                  <span
                    className="flex items-center gap-1.5 text-xs text-warn"
                    data-unsaved
                  >
                    <span className="size-1.5 rounded-full bg-warn" />
                    {t('unsaved')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
