import { useTranslation } from 'react-i18next';

import { Layers } from 'lucide-react';

import { agentOption } from '@config/agents';

import { cn } from '@utils/cnUtils';

import type { AgentId } from '@config/agents';
import type { ProjectSummary } from '@services/history/historyService';
import type { FC } from 'react';

export interface AllProjectsCardProps {
  readonly projects: readonly ProjectSummary[];
  readonly selected: boolean;
  readonly onSelect: () => void;
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
 * the scroller, so it cannot scroll away with the list it scopes, and the rule
 * under it runs the full width of the drawer to read as the edge of the list
 * rather than a gap in it. A layers mark and a count stand in for the initials
 * and the path a project would carry.
 */
export const AllProjectsCard: FC<AllProjectsCardProps> = ({
  projects,
  selected,
  onSelect,
}) => {
  const { t } = useTranslation('sidebar');
  const tallies = talliedBy(projects);
  const sessions = projects.reduce((total, project) => {
    return total + project.sessionCount;
  }, 0);

  return (
    <div className="shrink-0 border-b border-border px-3 pt-1 pb-2.5">
      <button
        type="button"
        aria-pressed={selected}
        data-all-projects
        onClick={onSelect}
        className={cn(`
          relative w-full overflow-hidden rounded-lg border px-2.5 py-2
          text-start transition-colors
          focus-visible:ring-2 focus-visible:ring-ring
        `, selected
          ? 'border-border bg-accent'
          : `
            border-transparent bg-card
            hover:bg-accent/50
          `)}
      >
        {selected && (
          <span
            aria-hidden="true"
            className="
              absolute inset-y-2.5 inset-s-0 w-0.5 rounded-e-full bg-primary
            "
          />
        )}
        <span className="flex items-center gap-2">
          <span className="
            flex size-5 shrink-0 items-center justify-center rounded-md bg-muted
            text-faint
          "
          >
            <Layers className="size-3" />
          </span>
          <span className="
            min-w-0 truncate text-ui font-semibold text-foreground
          "
          >
            {t('allProjects')}
          </span>
          <span className="ms-auto shrink-0 font-mono text-figure text-faint">
            {t('sessionTally', { count: sessions })}
          </span>
        </span>
        <span className="mt-0.5 block font-mono text-figure text-dim">
          {t('projectTally', { count: projects.length })}
        </span>
        {tallies.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1">
            {tallies.map((tally) => {
              return (
                <span
                  data-agent={tally.agent}
                  key={tally.agent}
                  className="
                    inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5
                    py-0.5 text-figure text-foreground-2
                  "
                >
                  <span
                    aria-hidden="true"
                    className="
                      project-provider-dot size-1.5 rounded-full bg-current
                    "
                  />
                  {agentOption(tally.agent).label}
                  <span className="font-mono text-faint">{tally.sessions}</span>
                </span>
              );
            })}
          </span>
        )}
      </button>
    </div>
  );
};
