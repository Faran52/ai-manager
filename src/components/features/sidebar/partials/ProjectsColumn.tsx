import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  FolderClosed,
  Layers,
  PanelLeft,
} from 'lucide-react';

import { toggleInArray } from '@utils/arrayUtils';

import {
  IconButton,
  SectionHeader,
  TextInput,
} from '@ui/index';

import { buildProjectTree } from '../utils/projectTreeUtils';

import { AllProjectsCard } from './AllProjectsCard';
import { CollapsedStrip } from './CollapsedStrip';
import { FoldingColumn } from './FoldingColumn';
import { FunnelMenu } from './FunnelMenu';
import { ProjectTree } from './ProjectTree';

import type { AgentId } from '@config/agents';
import type { AsyncStatus, ReportScope } from '@features/history-data';
import type { ProjectSummary } from '@services/history/historyService';
import type { FC, MouseEvent } from 'react';
import type { DateFilter } from '../utils/dateFilterUtils';
import type { StripItem } from './CollapsedStrip';
import type { FunnelOrder } from './FunnelMenu';

export interface ProjectsColumnProps {
  readonly open: boolean;
  readonly width: number;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly projects: readonly ProjectSummary[];
  readonly projectsStatus: AsyncStatus;
  readonly selectedProject: ProjectSummary | null;
  readonly nowMs: number;
  readonly wholeMachine: boolean;
  readonly reportScope: ReportScope | null;
  readonly showAllProjects: boolean;
  readonly showAgentChips: boolean;
  readonly onSelectProject: (project: ProjectSummary) => void;
  readonly onSelectAllProjects: () => void;
  readonly onSelectReportAgent: (agent: AgentId, profile?: string) => void;
  readonly onOpenMenu: (event: MouseEvent, project: ProjectSummary) => void;
}

// The left column: the project tree, its filters, and the scope card pinned above it.
export const ProjectsColumn: FC<ProjectsColumnProps> = ({
  open,
  width,
  onOpen,
  onClose,
  projects,
  projectsStatus,
  selectedProject,
  nowMs,
  wholeMachine,
  reportScope,
  showAllProjects,
  showAgentChips,
  onSelectProject,
  onSelectAllProjects,
  onSelectReportAgent,
  onOpenMenu,
}) => {
  const { t } = useTranslation('sidebar');
  const [textFilter, setTextFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [order, setOrder] = useState<FunnelOrder>('newest');
  const [activeAgents, setActiveAgents] = useState<readonly AgentId[]>([]);

  const agentCounts = useMemo(() => {
    const counts = new Map<AgentId, number>();

    for (const project of projects) {
      counts.set(project.agent, (counts.get(project.agent) ?? 0) + 1);
    }

    return counts;
  }, [projects]);

  const projectCount = useMemo(() => {
    return new Set(projects.map((project) => {
      return project.actualPath ?? `name:${project.name}`;
    })).size;
  }, [projects]);

  /*
   * Empty means every agent, so the first pick narrows and clearing the last widens
   * back out. The all-projects tallies and the Agents submenu both drive it.
   */
  const toggleAgent = (agent: AgentId): void => {
    setActiveAgents((current) => {
      if (current.length === 0) {
        return [agent];
      }

      return toggleInArray(current, agent);
    });
  };

  /*
   * A strip reads the same filtered list its open column does, so folding a
   * column away never changes what is in it.
   */
  const stripItems = (): readonly StripItem[] => {
    return [
      ...showAllProjects
        ? [{
            id: 'all-projects',
            label: t('allProjects'),
            mark: <Layers className="size-3.5" />,
            selected: wholeMachine,
            onSelect: onSelectAllProjects,
          }]
        : [],
      ...buildProjectTree(projects, {
        agentFilter: activeAgents,
        textFilter,
        dateFilter,
        order,
        nowMs,
      }).flatMap((group) => {
        const branch = group.agents[0];

        // v8 ignore next -- a group is built from at least one project branch.
        if (branch == null) {
          return [];
        }

        return group.matchesFilter
          ? [{
              id: group.key,
              label: group.name,
              selected: group.agents.some((option) => {
                return selectedProject?.agent === option.agent
                  && selectedProject.id === option.projectId;
              }),
              onSelect: (): void => {
                onSelectProject(branch.source);
              },
            }]
          : [];
      }),
    ];
  };

  return (
    <FoldingColumn
      open={open}
      width={width}
      className="bg-sidebar"
      strip={(
        <CollapsedStrip
          expandLabel={t('showProjects')}
          listLabel={t('projects')}
          items={stripItems()}
          onExpand={onOpen}
        />
      )}
    >
      <SectionHeader
        icon={<FolderClosed className="size-3.5" />}
        label={t('projects')}
        count={projectCount}
        casing="plain"
        action={(
          <IconButton
            label={t('hideProjects')}
            icon={<PanelLeft className="size-3.5" />}
            onClick={onClose}
          />
        )}
      />
      <div className="flex shrink-0 items-center gap-1.5 px-3 pb-2">
        <TextInput
          value={textFilter}
          onInput={setTextFilter}
          label={t('filterProjects')}
          placeholder={t('filterProjects')}
          className="min-w-0 flex-1"
        />
        <FunnelMenu
          label={t('filterAndSortProjects')}
          align="start"
          agents={{
            counts: agentCounts,
            active: activeAgents,
            onToggle: toggleAgent,
            onClear: () => {
              setActiveAgents([]);
            },
          }}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          order={order}
          onOrderChange={setOrder}
        />
      </div>
      {/* Pinned above the scroller: a scope control that scrolls away with
          the list it scopes has become a list item. */}
      {showAllProjects && (
        <AllProjectsCard
          projects={projects}
          selected={wholeMachine}
          onSelect={onSelectAllProjects}
          selectedScope={reportScope}
          onSelectAgent={onSelectReportAgent}
        />
      )}
      <ProjectTree
        projects={projects}
        projectsStatus={projectsStatus}
        agentFilter={activeAgents}
        textFilter={textFilter}
        dateFilter={dateFilter}
        order={order}
        selectedProject={selectedProject}
        nowMs={nowMs}
        showAgentChips={showAgentChips}
        onSelectProject={onSelectProject}
        onOpenMenu={onOpenMenu}
      />
    </FoldingColumn>
  );
};
