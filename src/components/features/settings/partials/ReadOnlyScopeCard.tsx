import { useTranslation } from 'react-i18next';

import { Lock } from 'lucide-react';

import { Panel } from '@ui/index';

import { KeyChips } from './KeyChips';
import { SettingsFilePath } from './SettingsFilePath';

import type { ScopeSettings } from '@services/settings/settingsService';
import type { FC } from 'react';

export interface ReadOnlyScopeCardProps {
  readonly scope: ScopeSettings;
}

export const ReadOnlyScopeCard: FC<ReadOnlyScopeCardProps> = ({ scope }) => {
  const { t } = useTranslation('settings');

  return (
    <Panel className="grid gap-3">
      <SettingsFilePath scope={scope} />
      {/* One quiet line, not a warning banner: nothing has gone wrong. */}
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
        {scope.preservedKeys.length === 0
          ? (
              <p className="text-body text-muted-foreground">
                {scope.exists ? t('holdsNothing') : t('notPresentHint')}
              </p>
            )
          : <KeyChips label={t('holds')} keys={scope.preservedKeys} />}
      </div>
    </Panel>
  );
};
