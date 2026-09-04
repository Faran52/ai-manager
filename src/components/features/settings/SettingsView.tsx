import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Check,
  CircleAlert,
  Loader2,
  Save,
  SlidersHorizontal,
} from 'lucide-react';

import {
  agentOption,
  projectScopedSettingsAgents,
  settingsAgents,
} from '@config/agents';

import { writeSettings } from '@lib/apis/apiClient';
import { toErrorMessage } from '@utils/errorUtils';

import {
  Button,
  EmptyState,
  Spinner,
} from '@ui/index';

import { EnvEditor, RuleListEditor } from './partials';

import type { AgentId } from '@config/agents';
import type { AsyncResource } from '@features/history-data';
import type {
  EnvEntry,
  ScopeSettings,
  SettingsPermissions,
  SettingsScope,
} from '@services/settings/settingsService';
import type { FC } from 'react';

export interface SettingsViewProps {
  readonly settings: AsyncResource<readonly ScopeSettings[]>;
  readonly projectPath: string | null;
  readonly agent: AgentId;
  readonly onSelectAgent: (agent: AgentId) => void;
}

interface Draft {
  readonly permissions: SettingsPermissions;
  readonly env: readonly EnvEntry[];
}

// Keys, not text, the map lives outside the component where t is unavailable.
const SCOPE_LABELS: Record<SettingsScope, string> = {
  user: 'scopeUser',
  project: 'scopeProject',
  local: 'scopeLocal',
};

const RULE_LISTS = ['allow', 'deny', 'ask'] as const;

const draftOf = (scope: ScopeSettings): Draft => {
  return {
    permissions: scope.permissions,
    env: scope.env,
  };
};

export const SettingsView: FC<SettingsViewProps> = ({
  settings,
  projectPath,
  agent,
  onSelectAgent,
}) => {
  const { t } = useTranslation('settings');
  const scopes = settings.data ?? [];
  const [active, setActive] = useState<SettingsScope>('user');
  const [draft, setDraft] = useState<Draft>();
  const [loadedKey, setLoadedKey] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const current = scopes.find((scope) => {
    return scope.scope === active;
  });
  const reload = settings.reload;

  // Adjusted during render rather than in an effect: an effect would paint the
  // previous scope's rules for a frame before replacing them.
  const scopeKey = current == null ? '' : current.path;

  if (scopeKey !== loadedKey) {
    setLoadedKey(scopeKey);
    setDraft(current == null ? undefined : draftOf(current));
    setSaved(false);
    setError(undefined);
  }

  // Both take the draft rather than reading it: they are only reachable from the
  // block below, where it is known to exist, so neither needs a null branch.
  const patch = (base: Draft, next: Partial<Draft>): void => {
    setDraft({
      ...base,
      ...next,
    });
    setSaved(false);
  };

  const save = (value: Draft): void => {
    setSaving(true);
    setError(undefined);
    void (async (): Promise<void> => {
      try {
        await writeSettings({
          projectPath: projectPath ?? '',
          scope: active,
          patch: value,
          agent,
        });
        setSaved(true);
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
    <div className="h-full overflow-y-auto p-4" data-settings-view>
      <div className="mx-auto grid max-w-3xl gap-4">
        <header className="grid gap-1">
          <h2 className="text-base font-semibold text-foreground">{t('heading')}</h2>
          <p className="text-sm text-muted-foreground">{t('intro')}</p>
        </header>

        <nav
          className="
            flex w-fit flex-wrap items-center gap-1 rounded-lg bg-muted p-0.5
          "
          aria-label={t('agents')}
        >
          {settingsAgents.map((option) => {
            return (
              <Button
                key={option}
                size="sm"
                variant={option === agent ? 'primary' : 'ghost'}
                pressed={option === agent}
                onClick={() => {
                  onSelectAgent(option);
                }}
              >
                {agentOption(option).label}
              </Button>
            );
          })}
        </nav>

        <nav
          className="flex w-fit items-center gap-1 rounded-lg bg-muted p-0.5"
          aria-label={t('scopes')}
        >
          {scopes.map((scope) => {
            return (
              <Button
                key={scope.scope}
                size="sm"
                variant={scope.scope === active ? 'primary' : 'ghost'}
                pressed={scope.scope === active}
                onClick={() => {
                  setActive(scope.scope);
                }}
              >
                {t(SCOPE_LABELS[scope.scope])}
              </Button>
            );
          })}
        </nav>

        {settings.status === 'loading' && <Spinner />}

        {settings.status === 'error' && (
          <p className="
            flex items-center gap-2 rounded-lg border border-destructive/40
            bg-destructive/10 px-3 py-2 text-xs text-destructive
          "
          >
            <CircleAlert className="size-3.5" />
            {settings.error}
          </p>
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
            grid gap-3 rounded-xl border border-border bg-card p-4
          "
          >
            <p className="font-mono text-[11px] break-all text-muted-foreground">
              {current.path}
              {!current.exists && ` · ${t('willBeCreated')}`}
            </p>
            <p className="
              flex items-center gap-2 rounded-lg border border-warn/40
              bg-warn/10 px-3 py-2 text-xs text-warn
            "
            >
              <CircleAlert className="size-3.5" />
              {t('readOnly')}
            </p>
            <p className="text-xs text-muted-foreground">{t('readOnlyHint')}</p>
            <p className="font-mono text-[11px] break-all text-muted-foreground" data-holds>
              {current.preservedKeys.length === 0
                ? t('holdsNothing')
                : t('holds', { keys: current.preservedKeys.join(', ') })}
            </p>
          </div>
        )}

        {current?.editable === true && draft != null && (
          <div className="
            grid gap-4 rounded-xl border border-border bg-card p-4
          "
          >
            <p className="font-mono text-[11px] break-all text-muted-foreground">
              {current.path}
              {!current.exists && ` · ${t('willBeCreated')}`}
            </p>

            {!current.readable && (
              <p className="
                flex items-center gap-2 rounded-lg border border-warn/40
                bg-warn/10 px-3 py-2 text-xs text-warn
              "
              >
                <CircleAlert className="size-3.5" />
                {t('unreadable')}
              </p>
            )}

            {RULE_LISTS.map((list) => {
              return (
                <RuleListEditor
                  key={list}
                  label={t(`permission_${list}`)}
                  hint={t(`permissionHint_${list}`)}
                  placeholder="Bash(git status:*)"
                  rules={draft.permissions[list]}
                  onChange={(rules) => {
                    patch(draft, {
                      permissions: {
                        ...draft.permissions,
                        [list]: rules,
                      },
                    });
                  }}
                />
              );
            })}

            <RuleListEditor
              label={t('permission_additionalDirectories')}
              hint={t('permissionHint_additionalDirectories')}
              placeholder="../shared-library"
              rules={draft.permissions.additionalDirectories}
              onChange={(rules) => {
                patch(draft, {
                  permissions: {
                    ...draft.permissions,
                    additionalDirectories: rules,
                  },
                });
              }}
            />

            <EnvEditor
              entries={draft.env}
              onChange={(entries) => {
                patch(draft, { env: entries });
              }}
            />

            {current.preservedKeys.length > 0 && (
              <p className="text-[11px] text-muted-foreground" data-preserved-keys>
                {t('preserved', { keys: current.preservedKeys.join(', ') })}
              </p>
            )}

            {error != null && (
              <p className="
                flex items-center gap-2 rounded-lg border border-destructive/40
                bg-destructive/10 px-3 py-2 text-xs text-destructive
              "
              >
                <CircleAlert className="size-3.5" />
                {error}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                disabled={saving || !current.readable}
                onClick={() => {
                  save(draft);
                }}
              >
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                {!saving && saved && <Check className="size-3.5" />}
                {!saving && !saved && <Save className="size-3.5" />}
                {saved && !saving ? t('saved') : t('save')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
