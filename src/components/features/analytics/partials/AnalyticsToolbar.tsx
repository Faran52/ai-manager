import { useTranslation } from 'react-i18next';

import { Button } from '@ui/index';

import type { FC } from 'react';
import type { AnalyticsPanelName } from '../AnalyticsView';
import type { Scope } from '../hooks/useAnalyticsScope';

export interface AnalyticsToolbarProps {
  readonly panel: AnalyticsPanelName;
  readonly onPanelChange: (panel: AnalyticsPanelName) => void;
  readonly scope: Scope;
  readonly onScopeChange: (scope: Scope) => void;
  readonly projectName: string;
}

const PANELS: readonly AnalyticsPanelName[] = ['report', 'sessions', 'edits'];

const PANEL_LABELS: Record<AnalyticsPanelName, string> = {
  report: 'panelReport',
  sessions: 'panelBoard',
  edits: 'panelEdits',
};

export const AnalyticsToolbar: FC<AnalyticsToolbarProps> = ({
  panel,
  onPanelChange,
  scope,
  onScopeChange,
  projectName,
}) => {
  const { t } = useTranslation('analytics');

  return (
    <div className="flex flex-wrap items-center gap-1 px-4 pt-4">
      <nav
        className="flex items-center gap-1 rounded-lg bg-muted p-0.5"
        aria-label={t('analyticsPanels')}
      >
        {PANELS.map((name) => {
          return (
            <Button
              key={name}
              size="sm"
              variant={name === panel ? 'primary' : 'ghost'}
              pressed={name === panel}
              onClick={() => {
                onPanelChange(name);
              }}
            >
              {t(PANEL_LABELS[name])}
            </Button>
          );
        })}
      </nav>

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
