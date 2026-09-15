import { useTranslation } from 'react-i18next';

import { sumBy } from 'es-toolkit';
import { Layers } from 'lucide-react';

import { agentBadgeLabel } from '@config/agents';

import { talliedBy } from '../utils/agentTallyUtils';

import type { AgentId } from '@config/agents';
import type { ReportScope } from '@features/history-data';
import type { ProjectSummary } from '@services/history/historyService';
import type { FC } from 'react';

export interface AllProjectsCardProps {
  readonly projects: readonly ProjectSummary[];
  readonly selected: boolean;
  readonly onSelect: () => void;
  // The agent and profile a tally chip is currently scoping the report to.
  readonly selectedScope: ReportScope | null;
  readonly onSelectAgent: (agent: AgentId, profile?: string) => void;
}

// Not a project, so it must not read as one of the eight: it sits outside the
// scroller and its rule runs the full width of the drawer.
export const AllProjectsCard: FC<AllProjectsCardProps> = ({
  projects,
  selected,
  onSelect,
  selectedScope,
  onSelectAgent,
}) => {
  const { t } = useTranslation('sidebar');
  const tallies = talliedBy(projects);
  const sessions = sumBy(projects, (project) => {
    return project.sessionCount;
  });

  return (
    <div className="all-projects-pin">
      <div className="project-card" data-active={selected}>
        <button
          type="button"
          aria-pressed={selected}
          data-all-projects
          onClick={onSelect}
          aria-label={t('allProjects')}
          className="project-card-heading"
        >
          <span aria-hidden="true" className="project-card-badge">
            <Layers className="size-3" />
          </span>
          <span className="project-card-name">{t('allProjects')}</span>
          <span className="project-card-total">
            {t('sessionTally', { count: sessions })}
          </span>
        </button>
        <p className="project-card-path">
          {t('projectTally', { count: projects.length })}
        </p>
        {tallies.length > 0 && (
          <div className="project-providers">
            {tallies.map((tally) => {
              // An agent id is never undefined, so no scope can never match.
              const active = tally.agent === selectedScope?.agent
                && tally.profile === selectedScope.profile;
              const label = agentBadgeLabel(tally.agent, tally.profile);

              return (
                <button
                  type="button"
                  key={`${tally.agent}:${tally.profile ?? ''}`}
                  data-agent={tally.agent}
                  data-profile={tally.profile}
                  data-selected={active}
                  aria-pressed={active}
                  aria-label={`${label}, ${t('sessionTally', {
                    count: tally.sessions,
                  })}`}
                  onClick={() => {
                    onSelectAgent(tally.agent, tally.profile);
                  }}
                  className="project-provider"
                >
                  <span className="project-provider-dot" aria-hidden />
                  <span className="project-provider-name">
                    {label}
                  </span>
                  <span className="project-provider-count">{tally.sessions}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
