import { useTranslation } from 'react-i18next';

import { Button } from '@ui/index';

import type { FC } from 'react';
import type { Scope } from '../hooks/useAnalyticsScope';

export interface AnalyticsToolbarProps {
  readonly scope: Scope;
  readonly onScopeChange: (scope: Scope) => void;
  readonly projectName: string;
}

export const AnalyticsToolbar: FC<AnalyticsToolbarProps> = ({
  scope,
  onScopeChange,
  projectName,
}) => {
  const { t } = useTranslation('analytics');

  return (
    <div className="flex flex-wrap items-center gap-1 px-4 pt-4">
      <div className="ms-auto flex items-center gap-1" aria-label={t('analyticsScope')}>
        <Button
          size="sm"
          variant={scope === 'global' ? 'primary' : 'ghost'}
          pressed={scope === 'global'}
          onClick={() => {
            onScopeChange('global');
          }}
        >
          {t('globalScope')}
        </Button>
        <Button
          size="sm"
          variant={scope === 'project' ? 'primary' : 'ghost'}
          pressed={scope === 'project'}
          onClick={() => {
            onScopeChange('project');
          }}
        >
          {t('projectScope', { project: projectName })}
        </Button>
      </div>
    </div>
  );
};
