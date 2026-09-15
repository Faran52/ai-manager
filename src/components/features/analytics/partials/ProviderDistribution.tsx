import { useTranslation } from 'react-i18next';

import { agentOption } from '@config/agents';

import { cn } from '@utils/cnUtils';
import { formatTokens } from '@utils/formatUtils';

import { BarRow, Panel } from '@ui/index';

import type { AgentStatsUsage } from '@services/stats/statsService';
import type { FC } from 'react';

export interface ProviderDistributionProps {
  readonly agents: readonly AgentStatsUsage[];
}

/*
 * Four columns rather than three. The tokens and the share are two figures, and
 * `6081M \u00b7 96%` right-aligned as one string lines up only its second half.
 */
const PROVIDER_GRID = `
  grid items-center gap-x-3 gap-y-2
  [grid-template-columns:minmax(0,max-content)_minmax(3.5rem,1fr)_max-content_max-content]
`;

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
    <Panel title={t('providerDistribution')} className="flex h-full flex-col">
      <ul className={cn('mt-3', PROVIDER_GRID)} data-provider-distribution>
        {ordered.map((agent, index) => {
          const share = total === 0 ? 0 : Math.round((agent.tokens / total) * 100);

          return (
            <BarRow
              index={index}
              key={agent.agent}
              label={t('providerLabel', {
                provider: agentOption(agent.agent).label,
                sessions: t('providerSessions', { count: agent.sessions }),
                projects: t('providerProjects', { count: agent.projects }),
              })}
              value={agent.tokens}
              max={max}
              formatValue={formatTokens}
              trailing={(
                <span className="
                  shrink-0 text-end font-mono text-figure text-muted-foreground
                  tabular-nums
                "
                >
                  {t('sharePercent', { share })}
                </span>
              )}
            />
          );
        })}
        {agents.length === 0 && (
          <li className="col-span-4 text-xs text-muted-foreground">{t('noProviders')}</li>
        )}
      </ul>
    </Panel>
  );
};
