import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { FolderSearch } from 'lucide-react';

import { agentOption } from '@config/agents';

import { formatTimeAgo } from '@utils/formatUtils';

import { EmptyState, Spinner } from '@ui/index';

import { buildProjectTree } from '../utils/projectTreeUtils';

import type { AgentId } from '@config/agents';
import type { ProjectSummary } from '@services/history/historyService';
import type { FC, MouseEvent } from 'react';

type Status = 'loading' | 'ready' | 'error';

export interface ProjectTreeProps {
  readonly projects: readonly ProjectSummary[];
  readonly projectsStatus: Status;
  readonly agentFilter: readonly AgentId[];
  readonly textFilter: string;
  readonly selectedProject: ProjectSummary | null;
  readonly nowMs: number;
  readonly onSelectProject: (project: ProjectSummary) => void;
  readonly onOpenMenu: (event: MouseEvent, project: ProjectSummary) => void;
}

export const ProjectTree: FC<ProjectTreeProps> = ({
  projects,
  projectsStatus,
  agentFilter,
  textFilter,
  selectedProject,
  nowMs,
  onSelectProject,
  onOpenMenu,
}) => {
  const { t, i18n } = useTranslation('sidebar');
  const groups = useMemo(() => {
    return buildProjectTree(projects, {
      agentFilter,
      textFilter,
    }).filter((group) => {
      return group.matchesFilter;
    });
  }, [agentFilter, projects, textFilter]);

  if (projectsStatus === 'loading') {
    return (
      <div className="flex justify-center py-8" data-projects-loading>
        <Spinner />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="px-3 py-8" data-projects-empty>
        <EmptyState
          icon={<FolderSearch className="size-9" />}
          title={t('noProjectSelected')}
          hint={t('selectProjectHint')}
        />
      </div>
    );
  }

  return (
    <ul className="project-navigator" aria-label={t('projects')} data-project-navigator>
      {groups.map((group) => {
        const primaryBranch = group.agents[0];

        // v8 ignore next -- groups are built from at least one project branch.
        if (primaryBranch == null) {
          return null;
        }

        const active = group.agents.some((branch) => {
          return selectedProject?.agent === branch.agent && selectedProject.id === branch.projectId;
        });

        return (
          <li className="project-card" data-active={active} key={group.key}>
            <button
              type="button"
              className="project-card-heading"
              aria-label={`${t('selectProject')}: ${group.name}`}
              onClick={() => {
                onSelectProject(primaryBranch.source);
              }}
              onContextMenu={(event) => {
                onOpenMenu(event, primaryBranch.source);
              }}
            >
              <span className="project-card-copy">
                <span className="project-card-name">{group.name}</span>
                {group.actualPath != null && (
                  <span className="project-card-path" title={group.actualPath}>{group.actualPath}</span>
                )}
              </span>
              <span className="project-card-total">
                {t('sessionCount', { count: group.sessionCount })}
              </span>
            </button>
            <div className="project-providers">
              {group.agents.map((branch) => {
                const selected = selectedProject?.agent === branch.agent
                  && selectedProject.id === branch.projectId;
                const label = agentOption(branch.agent).label;

                return (
                  <button
                    type="button"
                    className="project-provider"
                    data-agent={branch.agent}
                    data-selected={selected}
                    aria-pressed={selected}
                    aria-label={`${group.name}, ${label}, ${t('sessionCount', { count: branch.sessionCount })}`}
                    title={`${label} · ${t('sessionCount', { count: branch.sessionCount })} · ${formatTimeAgo(
                      branch.lastActivityMs,
                      nowMs,
                      i18n.language,
                    )}`}
                    key={`${group.key}:${branch.agent}`}
                    onClick={() => {
                      onSelectProject(branch.source);
                    }}
                    onContextMenu={(event) => {
                      onOpenMenu(event, branch.source);
                    }}
                  >
                    <span className="project-provider-dot" aria-hidden />
                    <span className="project-provider-name">{label}</span>
                    <span className="project-provider-count">{branch.sessionCount}</span>
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
