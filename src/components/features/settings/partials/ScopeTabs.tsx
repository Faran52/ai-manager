import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { motion } from 'motion/react';

import { cn } from '@utils/cnUtils';

import { controlTransition } from '@ui/index';

import { managedCount } from '../utils/settingsDraftUtils';

import type { ScopeSettings, SettingsScope } from '@services/settings/settingsService';
import type { FC } from 'react';
import type { Draft } from '../utils/settingsDraftUtils';

export interface ScopeTabsProps {
  readonly scopes: readonly ScopeSettings[];
  readonly active: SettingsScope;
  // Parked edits keyed by file path; a tab with one carries an unsaved dot.
  readonly drafts: Readonly<Record<string, Draft>>;
  readonly onSelect: (scope: SettingsScope) => void;
}

// Keys, not text, the map lives outside the component where t is unavailable.
const SCOPE_LABELS: Record<SettingsScope, string> = {
  user: 'scopeUser',
  project: 'scopeProject',
  local: 'scopeLocal',
};

// Tabs on the file: the agent is fixed by the Health card this opened from.
export const ScopeTabs: FC<ScopeTabsProps> = ({
  scopes,
  active,
  drafts,
  onSelect,
}) => {
  const { t } = useTranslation('settings');
  // One underline for the strip, so it slides between files rather than
  // vanishing under one tab and appearing under the next.
  const markerId = useId();

  return (
    <nav
      className={cn(
        'flex items-center gap-1 border-b border-border',
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
              onSelect(scope.scope);
            }}
            className={cn(
              `
                relative flex items-center gap-1.5 px-3 py-1.5 text-xs
                font-medium transition-colors
              `,
              scope.scope === active
                ? 'text-foreground'
                : `
                  text-muted-foreground
                  hover:text-foreground
                `,
            )}
          >
            {scope.scope === active && (
              <motion.span
                className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
                layoutId={markerId}
                transition={controlTransition}
              />
            )}
            {t(SCOPE_LABELS[scope.scope])}
            {/*
              What is in the file, so three scopes do not have to be opened one
              at a time to find which of them holds anything. Only where the
              number means something: the count is of rules this screen
              manages, which is always zero on a read-only surface and so read
              as empty beside a file holding thirteen areas.
            */}
            {(!scope.exists || scope.editable === true) && (
              <span className="font-mono text-figure font-normal opacity-60">
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
  );
};
