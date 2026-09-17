import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { FolderSearch } from 'lucide-react';
import { motion } from 'motion/react';

import { agentBadgeLabel } from '@config/agents';

import { formatTimeAgo, tildePath } from '@utils/formatUtils';
import { initialsOf } from '@utils/initialsUtils';

import {
  arriveInSequence,
  EmptyState,
  Spinner,
} from '@ui/index';

import { buildProjectTree } from '../utils/projectTreeUtils';

import type { AgentId } from '@config/agents';
import type { AsyncStatus } from '@features/history-data';
import type { ProjectSummary } from '@services/history/historyService';
import type { FC, MouseEvent } from 'react';
import type { DateFilter } from '../utils/dateFilterUtils';
import type { FunnelOrder } from './FunnelMenu';

export interface ProjectTreeProps {
  readonly projects: readonly ProjectSummary[];
  readonly projectsStatus: AsyncStatus;
  readonly agentFilter: readonly AgentId[];
  readonly textFilter: string;
  readonly dateFilter: DateFilter;
  readonly order: FunnelOrder;
  readonly selectedProject: ProjectSummary | null;
  readonly nowMs: number;
  readonly onSelectProject: (project: ProjectSummary) => void;
  readonly onOpenMenu: (event: MouseEvent, project: ProjectSummary) => void;
  // The per-agent tally chips under a card. Health reads the project as one
  // folder, so it leaves them off.
  readonly showAgentChips?: boolean;
}

export const ProjectTree: FC<ProjectTreeProps> = ({
  projects,
  projectsStatus,
  agentFilter,
  textFilter,
  dateFilter,
  order,
  selectedProject,
  nowMs,
  onSelectProject,
  onOpenMenu,
  showAgentChips = true,
}) => {
  const { t, i18n } = useTranslation('sidebar');
  const groups = useMemo(() => {
    return buildProjectTree(projects, {
      agentFilter,
      textFilter,
      dateFilter,
      order,
      nowMs,
    }).filter((group) => {
      return group.matchesFilter;
    });
  }, [agentFilter, dateFilter, nowMs, order, projects, textFilter]);

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
      {groups.map((group, index) => {
        const primaryBranch = group.agents[0];

        // v8 ignore next -- groups are built from at least one project branch.
        if (primaryBranch == null) {
          return null;
        }

        const active = group.agents.some((branch) => {
          return selectedProject?.agent === branch.agent && selectedProject.id === branch.projectId;
        });

        return (
          <motion.li
            className="project-card"
            data-active={active}
            key={group.key}
            {...arriveInSequence(index)}
          >
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
              {/* The mark a project carries in the strip stands in for it here
                  too: two letters where a project name has none of its own. */}
              <span aria-hidden="true" className="project-card-badge">
                {initialsOf(group.name)}
              </span>
              <span className="project-card-name">{group.name}</span>
              <span className="project-card-total">
                {t('sessionCount', { count: group.sessionCount })}
              </span>
            </button>
            {group.actualPath != null && (
              <p className="project-card-path" title={group.actualPath}>{tildePath(group.actualPath)}</p>
            )}
            {showAgentChips && (
              <div className="project-providers">
                {group.agents.map((branch) => {
                  const selected = selectedProject?.agent === branch.agent
                    && selectedProject.id === branch.projectId;
                  const label = agentBadgeLabel(branch.agent, branch.source.profile);
                  // A worktree makes the same agent appear twice in one group, so
                  // the row is named and keyed by the project it reads, not the agent.
                  const branchName = branch.worktree == null
                    ? label
                    : `${label} · ${branch.worktree}`;

                  return (
                    <button
                      type="button"
                      className="project-provider"
                      data-agent={branch.agent}
                      data-selected={selected}
                      aria-pressed={selected}
                      aria-label={`${group.name}, ${branchName}, ${t('sessionCount', { count: branch.sessionCount })}`}
                      title={`${branchName} · ${t('sessionCount', { count: branch.sessionCount })} · ${formatTimeAgo(
                        branch.lastActivityMs,
                        nowMs,
                        i18n.language,
                      )}`}
                      key={`${group.key}:${branch.agent}:${branch.projectId}`}
                      onClick={() => {
                        onSelectProject(branch.source);
                      }}
                      onContextMenu={(event) => {
                        onOpenMenu(event, branch.source);
                      }}
                    >
                      <span className="project-provider-dot" aria-hidden />
                      <span className="project-provider-name">{label}</span>
                      {branch.worktree != null && (
                        <span className="project-provider-worktree">{branch.worktree}</span>
                      )}
                      <span className="project-provider-count">{branch.sessionCount}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
};
