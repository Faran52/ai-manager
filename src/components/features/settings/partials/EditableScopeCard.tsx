import { useTranslation } from 'react-i18next';

import {
  Check,
  Loader2,
  Save,
} from 'lucide-react';

import {
  Button,
  Eyebrow,
  Notice,
  Panel,
  useMutationRunner,
} from '@ui/index';

import { EnvEditor } from './EnvEditor';
import { KeyChips } from './KeyChips';
import { RuleListEditor } from './RuleListEditor';
import { SettingsFilePath } from './SettingsFilePath';

import type { ScopeSettings } from '@services/settings/settingsService';
import type { FC } from 'react';
import type { Draft } from '../utils/settingsDraftUtils';

export interface EditableScopeCardProps {
  readonly scope: ScopeSettings;
  readonly draft: Draft;
  readonly mutation: ReturnType<typeof useMutationRunner>;
  readonly dirty: boolean;
  readonly saved: boolean;
  readonly onPatch: (next: Partial<Draft>) => void;
  readonly onSave: () => void;
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

export const EditableScopeCard: FC<EditableScopeCardProps> = ({
  scope,
  draft,
  mutation,
  dirty,
  saved,
  onPatch,
  onSave,
}) => {
  const { t } = useTranslation('settings');

  return (
    <Panel className="grid gap-4">
      <SettingsFilePath scope={scope} />

      {!scope.readable && (
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
              onPatch({
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
          onPatch({
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
          onPatch({ env: entries });
        }}
      />

      {/*
        Folded away: the keys this screen will not touch were the largest,
        least actionable block on the card. Native details, nothing else needs its state.
      */}
      {scope.preservedKeys.length > 0 && (
        <details data-preserved-keys>
          <summary className="
            cursor-pointer text-body text-muted-foreground
            hover:text-foreground
          "
          >
            {t('preservedCount', { count: scope.preservedKeys.length })}
          </summary>
          <div className="mt-2">
            <KeyChips keys={scope.preservedKeys} />
          </div>
        </details>
      )}

      {mutation.error.length > 0 && (
        <Notice>{mutation.error}</Notice>
      )}

      {/*
        Sticky so a rule added at the top can be saved without a scroll.
        -bottom-4 cancels the scroller pb-4 so the bar reaches the true edge.
      */}
      <div className="
        sticky -bottom-4 -mx-4 -mb-4 flex items-center gap-3 rounded-b-lg
        border-t border-border bg-card px-4 py-3
      "
      >
        <Button
          variant="primary"
          disabled={mutation.busy || !scope.readable}
          onClick={onSave}
        >
          {mutation.busy && <Loader2 className="size-3.5 animate-spin" />}
          {!mutation.busy && saved && <Check className="size-3.5" />}
          {!mutation.busy && !saved && <Save className="size-3.5" />}
          {saved && !mutation.busy ? t('saved') : t('save')}
        </Button>
        {dirty && !mutation.busy && (
          <span
            className="flex items-center gap-1.5 text-xs text-warn"
            data-unsaved
          >
            <span className="size-1.5 rounded-full bg-warn" />
            {t('unsaved')}
          </span>
        )}
      </div>
    </Panel>
  );
};
