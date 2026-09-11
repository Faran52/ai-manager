import { useTranslation } from 'react-i18next';

import { Layers } from 'lucide-react';

import { agentOption } from '@config/agents';

import type { AgentId } from '@config/agents';
import type { ProjectSummary } from '@services/history/historyService';
import type { FC } from 'react';

export interface AllProjectsCardProps {
  readonly projects: readonly ProjectSummary[];
  readonly selected: boolean;
  readonly onSelect: () => void;
  // The agent a tally chip is currently scoping the report to, if any.
  readonly selectedAgent: AgentId | null;
  readonly onSelectAgent: (agent: AgentId) => void;
}

interface AgentTally {
  readonly agent: AgentId;
  readonly sessions: number;
}

const talliedBy = (projects: readonly ProjectSummary[]): readonly AgentTally[] => {
  const sessions = new Map<AgentId, number>();

  for (const project of projects) {
    sessions.set(project.agent, (sessions.get(project.agent) ?? 0) + project.sessionCount);
  }

  return [...sessions.entries()].map(([agent, count]) => {
    return {
      agent,
      sessions: count,
    };
  }).sort((left, right) => {
    return right.sessions - left.sessions;
  });
};

/**
 * Every project at once, pinned above the list rather than first inside it.
 *
 * It is not a project, so it must not read as one of the eight: it sits outside
 * the scroller and the rule under it runs the full width of the drawer. Its
 * agent tallies are branches like a project card's, and picking one scopes the
 * report to that agent's activity across every project it has touched.
 */
export const AllProjectsCard: FC<AllProjectsCardProps> = ({
  projects,
  selected,
  onSelect,
  selectedAgent,
  onSelectAgent,
}) => {
  const { t } = useTranslation('sidebar');
  const tallies = talliedBy(projects);
  const sessions = projects.reduce((total, project) => {
    return total + project.sessionCount;
  }, 0);

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
              const active = tally.agent === selectedAgent;

              return (
                <button
                  type="button"
                  key={tally.agent}
                  data-agent={tally.agent}
                  data-selected={active}
                  aria-pressed={active}
                  aria-label={`${agentOption(tally.agent).label}, ${t('sessionTally', {
                    count: tally.sessions,
                  })}`}
                  onClick={() => {
                    onSelectAgent(tally.agent);
                  }}
                  className="project-provider"
                >
                  <span className="project-provider-dot" aria-hidden />
                  <span className="project-provider-name">
                    {agentOption(tally.agent).label}
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
