import { useTranslation } from 'react-i18next';

import { agentOption } from '@config/agents';

import { formatTokens } from '@utils/formatUtils';

import { BarRow } from '@ui/index';

import { AnalyticsPanel } from './AnalyticsPanel';

import type { AgentStatsUsage } from '@services/stats/statsService';
import type { FC } from 'react';

export interface ProviderDistributionProps {
  readonly agents: readonly AgentStatsUsage[];
}

export const ProviderDistribution: FC<ProviderDistributionProps> = ({ agents }) => {
  const { t } = useTranslation('analytics');
  const ordered = [...agents].sort((left, right) => {
    return right.tokens - left.tokens;
  });
  const total = ordered.reduce((sum, agent) => {
    return sum + agent.tokens;
  }, 0);
  const max = ordered[0]?.tokens ?? 0;

  return (
    <AnalyticsPanel title={t('providerDistribution')}>
      <ul className="mt-3 space-y-3" data-provider-distribution>
        {ordered.map((agent) => {
          const share = total === 0 ? 0 : Math.round((agent.tokens / total) * 100);

          return (
            <BarRow
              key={agent.agent}
              label={t('providerLabel', {
                provider: agentOption(agent.agent).label,
                sessions: agent.sessions,
                projects: agent.projects,
              })}
              value={agent.tokens}
              max={max}
              formatValue={(tokens) => {
                return t('tokensWithShare', {
                  tokens: formatTokens(tokens),
                  share,
                });
              }}
            />
          );
        })}
        {agents.length === 0 && <li className="text-xs text-muted-foreground">{t('noProviders')}</li>}
      </ul>
    </AnalyticsPanel>
  );
};
