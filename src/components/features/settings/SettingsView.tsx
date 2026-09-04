import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Check,
  CircleAlert,
  FileCode2,
  Loader2,
  Lock,
  Save,
  SlidersHorizontal,
} from 'lucide-react';

import {
  agentOption,
  editableSettingsAgents,
  projectScopedSettingsAgents,
  settingsAgents,
} from '@config/agents';

import { writeSettings } from '@lib/apis/apiClient';
import { cn } from '@utils/cnUtils';
import { toErrorMessage } from '@utils/errorUtils';

import {
  Badge,
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

/**
 * The tone is the list: allow, deny and ask are opposites that used to render
 * identically, and additionalDirectories below is not a verdict on a tool.
 * A placeholder each, because one shared example rendered the three lists as
 * the same field repeated three times.
 */
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

/**
 * What the scope tab counts: the rules and variables this screen manages, so a
 * file with nothing in it says so without being opened. Takes a Draft, because
 * a parked edit is counted too: reading the file while the section below it
 * showed the edited list had the tab say 0 beside a list saying 1.
 */
const managedCount = (source: Draft): number => {
  return source.permissions.allow.length
    + source.permissions.deny.length
    + source.permissions.ask.length
    + source.permissions.additionalDirectories.length
    + source.env.length;
};

const draftOf = (scope: ScopeSettings): Draft => {
  return {
    permissions: scope.permissions,
    env: scope.env,
  };
};

// The file path, above whichever body the scope earns. Both branches showed it,
// and only one of them called it anything.
const FilePath: FC<{ readonly scope: ScopeSettings }> = ({ scope }) => {
  const { t } = useTranslation('settings');
  return (
    <div className="flex items-center gap-2 border-b border-border pb-3">
      <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="
        text-[10px] font-semibold tracking-wider text-muted-foreground uppercase
      "
      >
        {t('file')}
      </span>
      <span className="
        min-w-0 flex-1 font-mono text-[11px] break-all text-foreground
      "
      >
        {scope.path}
      </span>
      {/*
        A read-only surface has no Save button, so promising it would be created
        on save was a contradiction: three of the five agents opened on a file
        that said it was about to be written and offered nothing to write it.
      */}
      {!scope.exists && (
        <Badge tone="warn">
          {scope.editable === true ? t('willBeCreated') : t('notPresent')}
        </Badge>
      )}
    </div>
  );
};

/**
 * The keys a surface reports, as chips rather than one comma-joined string: a
 * real Codex config names thirteen areas and Claude's user file sixteen keys,
 * which ran as an eleven-line paragraph of mono text.
 */
const KeyChips: FC<{ readonly keys: readonly string[] }> = ({ keys }) => {
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((key) => {
        return <Badge key={key}>{key}</Badge>;
      })}
    </div>
  );
};

const KeyList: FC<{
  readonly label: string;
  readonly keys: readonly string[];
}> = ({ label, keys }) => {
  return (
    <div className="grid gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <KeyChips keys={keys} />
    </div>
  );
};

// A group heading, so the three verdicts read as one set rather than as peers of
// the directory list and the environment.
const GroupLabel: FC<{ readonly children: string }> = ({ children }) => {
  return (
    <span className="
      text-[10px] font-semibold tracking-wider text-muted-foreground uppercase
    "
    >
      {children}
    </span>
  );
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
    <div className="h-full overflow-y-auto p-4" data-settings-view>
      <div className="mx-auto grid max-w-3xl gap-4">
        <header className="grid gap-1">
          <h2 className="text-base font-semibold text-foreground">{t('heading')}</h2>
          <p className="text-sm text-muted-foreground">{t('intro')}</p>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="
              text-[10px] font-semibold tracking-wider text-muted-foreground
              uppercase
            "
            aria-hidden="true"
          >
            {t('agents')}
          </span>
          <nav
            className="
              flex w-fit flex-wrap items-center gap-1 rounded-lg bg-muted p-0.5
            "
            aria-label={t('agents')}
          >
            {settingsAgents.map((option) => {
              const writable = editableSettingsAgents.includes(option);
              return (
                <Button
                  key={option}
                  size="sm"
                  variant={option === agent ? 'primary' : 'ghost'}
                  pressed={option === agent}
                  {...writable ? {} : { title: t('readOnly') }}
                  onClick={() => {
                    onSelectAgent(option);
                  }}
                >
                  {/*
                    Four of the five are read-only, which used to take opening
                    the tab to find out.
                  */}
                  {!writable && <Lock className="size-3 opacity-60" />}
                  {agentOption(option).label}
                </Button>
              );
            })}
          </nav>
        </div>

        {/*
          Tabs on the file rather than a second pill bar: the agent picker above
          chooses which product's settings, and these choose which of its files,
          so the two used to look like peers when one nests inside the other.
        */}
        <nav
          className={cn(
            '-mb-2 flex items-center gap-1 border-b border-border',
            scopes.length === 0 && 'hidden',
          )}
          aria-label={t('scopes')}
        >
          {scopes.map((scope) => {
            return (
              <button
                key={scope.scope}
                type="button"
                aria-current={scope.scope === active ? 'true' : undefined}
                onClick={() => {
                  setActive(scope.scope);
                  setError(undefined);
                }}
                className={cn(
                  `
                    -mb-px flex items-center gap-1.5 border-b-2 px-3 py-1.5
                    text-xs font-medium transition-colors
                  `,
                  scope.scope === active
                    ? 'border-primary text-foreground'
                    : `
                      border-transparent text-muted-foreground
                      hover:text-foreground
                    `,
                )}
              >
                {t(SCOPE_LABELS[scope.scope])}
                {/*
                  What is in the file, so three scopes do not have to be opened
                  one at a time to find which of them holds anything.
                */}
                {/*
                  Only where the number means something: the count is of rules
                  this screen manages, which is always zero on a read-only
                  surface and so read as "empty" beside a file holding thirteen
                  areas.
                */}
                {(!scope.exists || scope.editable === true) && (
                  <span className="font-mono text-[10px] font-normal opacity-60">
                    {scope.exists ? managedCount(drafts[scope.path] ?? scope) : t('absent')}
                  </span>
                )}
                {drafts[scope.path] != null && (
                  <span
                    className="size-1.5 rounded-full bg-warn"
                    title={t('unsaved')}
                  />
                )}
              </button>
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
            <FilePath scope={current} />
            {/*
              Once. The picker already carries a lock on this agent, so a
              full-width warning banner and a paragraph under it stated the same
              fact a second and a third time, and the banner's colour claimed
              something had gone wrong when nothing had.
            */}
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
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
                    <p className="text-[11px] text-muted-foreground">
                      {current.exists ? t('holdsNothing') : t('notPresentHint')}
                    </p>
                  )
                : <KeyList label={t('holds')} keys={current.preservedKeys} />}
            </div>
          </div>
        )}

        {current?.editable === true && draft != null && (
          <div className="
            grid gap-4 rounded-xl border border-border bg-card p-4
          "
          >
            <FilePath scope={current} />

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

            <GroupLabel>{t('groupPermissions')}</GroupLabel>
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

            <GroupLabel>{t('groupDirectories')}</GroupLabel>
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

            <GroupLabel>{t('groupEnvironment')}</GroupLabel>
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
                  cursor-pointer text-[11px] text-muted-foreground
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
              <p className="
                flex items-center gap-2 rounded-lg border border-destructive/40
                bg-destructive/10 px-3 py-2 text-xs text-destructive
              "
              >
                <CircleAlert className="size-3.5" />
                {error}
              </p>
            )}

            {/*
              Sticky so it stays reachable: four rule lists and the environment
              editor sit above it, and a rule added at the top used to need a
              scroll to the bottom to commit it.
            */}
            <div className="
              sticky bottom-0 -mx-4 -mb-4 flex items-center gap-3 rounded-b-xl
              border-t border-border bg-card px-4 py-3
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
  );
};
