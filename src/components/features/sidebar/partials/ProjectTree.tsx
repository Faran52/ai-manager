import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { treeExpandedStateKey } from '@config/storageKeys';

import { Spinner } from '@ui/index';

import { buildAgentTree } from '../utils/agentTreeUtils';

import {
  type TreeLevel,
  type TreeNode,
  TreeRow,
} from './TreeRow';

import type { AgentId } from '@config/agents';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type {
  FC,
  KeyboardEvent,
  MouseEvent,
} from 'react';
import type {
  TreeAgent,
  TreeProject,
  TreeSession,
} from '../utils/agentTreeUtils';

interface MenuTargetProject { kind: 'project';
  project: TreeProject; }
interface MenuTargetSession { kind: 'session';
  session: TreeSession; }
type MenuTarget = MenuTargetProject | MenuTargetSession;

type Status = 'loading' | 'ready' | 'error';

interface ExpandedState {
  readonly agents: readonly string[];
  readonly projects: readonly string[];
}

interface ProjectTreeProps {
  readonly projects: readonly ProjectSummary[];
  readonly sessions: readonly SessionSummary[];
  readonly projectsStatus: Status;
  readonly sessionsStatus: Status;
  readonly agentFilter: readonly AgentId[];
  readonly textFilter: string;
  readonly selectedFilePath: string | null;
  readonly selectionMode: boolean;
  readonly selectedSessionPaths: readonly string[];
  readonly onSessionSelect: (session: TreeSession) => void;
  readonly onOpenMenu: (event: MouseEvent, target: MenuTarget) => void;
  readonly onRequestSessions: (agent: AgentId, projectId: string) => void;
}

interface ProjectListProps {
  readonly agent: TreeAgent;
  readonly filterMatches: (matchesFilter: boolean) => boolean;
  readonly isProjectExpanded: (projectId: string) => boolean;
  readonly isProjectLoading: (projectId: string) => boolean;
  readonly nowMs: number;
  readonly onOpenMenu: (event: MouseEvent, project: TreeProject) => void;
  readonly onKeyDown: (event: KeyboardEvent, node: TreeNode, level: TreeLevel) => void;
  readonly renderSessionList: (project: TreeProject) => React.ReactNode;
}

interface SessionListProps {
  readonly project: TreeProject;
  readonly selectedFilePath: string | null;
  readonly selectionMode: boolean;
  readonly selectedSessionPaths: readonly string[];
  readonly nowMs: number;
  readonly onSessionSelect: (session: TreeSession) => void;
  readonly onOpenMenu: (event: MouseEvent, session: TreeSession) => void;
  readonly onKeyDown: (event: KeyboardEvent, node: TreeNode, level: TreeLevel) => void;
  readonly sessionsStatus: 'loading' | 'ready' | 'error';
}

const hasAgentsAndProjects = (value: object): boolean => {
  if (!Object.prototype.hasOwnProperty.call(value, 'agents')
    || !Object.prototype.hasOwnProperty.call(value, 'projects')) {
    return false;
  }
  const agents = value['agents' as keyof typeof value];
  const projects = value['projects' as keyof typeof value];
  return Array.isArray(agents) && Array.isArray(projects);
};

const isExpandedState = (value: unknown): value is ExpandedState => {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  return hasAgentsAndProjects(value);
};

const loadExpandedState = (): ExpandedState => {
  try {
    const stored = localStorage.getItem(treeExpandedStateKey);
    if (stored != null) {
      const parsed: unknown = JSON.parse(stored);
      if (isExpandedState(parsed)) {
        return parsed;
      }
    }
  }
  catch {
    // Ignore parse errors, return defaults
  }
  return {
    agents: [],
    projects: [],
  };
};

const saveExpandedState = (state: ExpandedState): void => {
  localStorage.setItem(treeExpandedStateKey, JSON.stringify(state));
};

const getDefaultExpandedAgent = (tree: readonly TreeAgent[]): string | null => {
  if (tree.length === 0) {
    return null;
  }
  const firstAgent = tree[0];
  return firstAgent ? firstAgent.agent : null;
};

const makeProjectKey = (agent: AgentId, projectId: string): string => {
  return `${agent}:${projectId}`;
};

const filterMatches = (textFilter: string, matchesFilter: boolean): boolean => {
  return matchesFilter || textFilter.trim().length === 0;
};

const getRtlKeys = (dir: string): { readonly left: string;
  readonly right: string; } => {
  const isRtl = dir === 'rtl';
  return {
    left: isRtl ? 'ArrowRight' : 'ArrowLeft',
    right: isRtl ? 'ArrowLeft' : 'ArrowRight',
  };
};

const isAgentNode = (_node: TreeNode, level: TreeLevel): _node is TreeAgent => {
  return level === 'agent';
};

const isProjectNode = (_node: TreeNode, level: TreeLevel): _node is TreeProject => {
  return level === 'project';
};

const handleExpansionKey = (
  event: KeyboardEvent,
  node: TreeNode,
  level: TreeLevel,
  keys: { readonly left: string;
    readonly right: string; },
  isAgentExpanded: (agent: AgentId) => boolean,
  isProjectExpanded: (agent: AgentId, projectId: string) => boolean,
  toggleAgent: (agent: AgentId) => void,
  toggleProject: (agent: AgentId, projectId: string) => void,
): void => {
  if (event.key === keys.right) {
    event.preventDefault();
    if (isAgentNode(node, level) && !isAgentExpanded(node.agent)) {
      toggleAgent(node.agent);
    }
    else if (isProjectNode(node, level) && !isProjectExpanded(node.agent, node.id)) {
      toggleProject(node.agent, node.id);
    }
  }
  else if (event.key === keys.left) {
    event.preventDefault();
    if (isAgentNode(node, level) && isAgentExpanded(node.agent)) {
      toggleAgent(node.agent);
    }
    else if (isProjectNode(node, level) && isProjectExpanded(node.agent, node.id)) {
      toggleProject(node.agent, node.id);
    }
  }
};

const handleActivationKey = (
  event: KeyboardEvent,
  node: TreeNode,
  level: TreeLevel,
  toggleAgent: (agent: AgentId) => void,
  toggleProject: (agent: AgentId, projectId: string) => void,
): void => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (isAgentNode(node, level)) {
      toggleAgent(node.agent);
    }
    else if (isProjectNode(node, level)) {
      toggleProject(node.agent, node.id);
    }
  }
};

const ProjectList = ({
  agent,
  filterMatches: filterProjects,
  isProjectExpanded,
  isProjectLoading,
  nowMs,
  onOpenMenu,
  onKeyDown,
  renderSessionList,
}: ProjectListProps): React.ReactElement => {
  return (
    <ul role="group">
      {agent.projects
        .filter((project) => {
          return filterProjects(project.matchesFilter);
        })
        .map((project) => {
          const projectExpanded = isProjectExpanded(project.id);
          const projectLoading = isProjectLoading(project.id);

          return (
            <li key={project.id} role="treeitem" aria-level={2} aria-selected="false">
              <TreeRow
                node={project}
                level="project"
                expanded={projectExpanded}
                selected={false}
                loading={projectLoading}
                nowMs={nowMs}
                onSelect={() => {
                  return undefined;
                }}
                onContextMenu={(event) => {
                  onOpenMenu(event, project);
                }}
                onKeyDown={(event) => {
                  onKeyDown(event, project, 'project');
                }}
              />
              {projectExpanded && renderSessionList(project)}
            </li>
          );
        })}
    </ul>
  );
};

const SessionList = ({
  project,
  selectedFilePath,
  selectionMode,
  selectedSessionPaths,
  nowMs,
  onSessionSelect,
  onOpenMenu,
  onKeyDown,
  sessionsStatus,
}: SessionListProps): React.ReactElement => {
  return (
    <ul role="group">
      {project.sessions.map((session) => {
        const sessionSelected = session.filePath === selectedFilePath;
        const isSelected = selectionMode
          ? selectedSessionPaths.includes(session.filePath)
          : sessionSelected;

        return (
          <li key={session.filePath} role="treeitem" aria-level={3} aria-selected={isSelected}>
            <TreeRow
              node={session}
              level="session"
              expanded={false}
              selected={isSelected}
              loading={false}
              nowMs={nowMs}
              onSelect={() => {
                onSessionSelect(session);
              }}
              onContextMenu={(event) => {
                onOpenMenu(event, session);
              }}
              onKeyDown={(event) => {
                onKeyDown(event, session, 'session');
              }}
            />
          </li>
        );
      })}
      {sessionsStatus === 'loading' && (
        <li className="flex justify-center py-2" role="treeitem" aria-level={3} aria-selected="false">
          <Spinner />
        </li>
      )}
    </ul>
  );
};

export const ProjectTree: FC<ProjectTreeProps> = ({
  projects,
  sessions,
  projectsStatus,
  sessionsStatus,
  agentFilter,
  textFilter,
  selectedFilePath,
  selectionMode,
  selectedSessionPaths,
  onSessionSelect,
  onOpenMenu,
  onRequestSessions,
}) => {
  const { i18n } = useTranslation('sidebar');
  const [expandedAgents, setExpandedAgents] = useState<readonly string[]>(() => {
    return loadExpandedState().agents;
  });
  const [expandedProjects, setExpandedProjects] = useState<readonly string[]>(() => {
    return loadExpandedState().projects;
  });
  const [loadingProjects, setLoadingProjects] = useState<readonly string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [nowMs, setNowMs] = useState(() => {
    return Date.now();
  });

  const tree = useMemo(() => {
    return buildAgentTree(projects, sessions, {
      agentFilter,
      textFilter,
      selectedFilePath,
    });
  }, [agentFilter, projects, selectedFilePath, sessions, textFilter]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(() => {
        return Date.now();
      });
    }, 60_000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!initialized && tree.length > 0 && expandedAgents.length === 0 && expandedProjects.length === 0) {
      const defaultAgent = getDefaultExpandedAgent(tree);
      if (defaultAgent != null) {
        const nextAgents = [defaultAgent];
        const timer = setTimeout(() => {
          setExpandedAgents(nextAgents);
          saveExpandedState({
            agents: nextAgents,
            projects: [],
          });
          setInitialized(true);
        }, 0);
        return () => {
          clearTimeout(timer);
        };
      }
    }
  }, [expandedAgents, expandedProjects, initialized, tree]);

  useEffect(() => {
    saveExpandedState({
      agents: expandedAgents,
      projects: expandedProjects,
    });
  }, [expandedAgents, expandedProjects]);

  const isAgentExpanded = (agent: AgentId): boolean => {
    return expandedAgents.includes(agent);
  };

  const isProjectExpanded = (agent: AgentId, projectId: string): boolean => {
    return expandedProjects.includes(makeProjectKey(agent, projectId));
  };

  const isProjectLoading = (agent: AgentId, projectId: string): boolean => {
    return loadingProjects.includes(makeProjectKey(agent, projectId));
  };

  const toggleAgent = (agent: AgentId): void => {
    setExpandedAgents((current) => {
      const next = current.includes(agent)
        ? current.filter((a) => {
            return a !== agent;
          })
        : [...current, agent];
      saveExpandedState({
        agents: next,
        projects: expandedProjects,
      });
      return next;
    });
  };

  const toggleProject = (agent: AgentId, projectId: string): void => {
    const key = makeProjectKey(agent, projectId);
    const currentlyExpanded = expandedProjects.includes(key);

    setExpandedProjects((current) => {
      const next = currentlyExpanded
        ? current.filter((p) => {
            return p !== key;
          })
        : [...current, key];

      if (!currentlyExpanded && !loadingProjects.includes(key)) {
        setLoadingProjects((lp) => {
          return [...lp, key];
        });
        onRequestSessions(agent, projectId);
      }

      saveExpandedState({
        agents: expandedAgents,
        projects: next,
      });
      return next;
    });
  };

  const handleKeyDown = (event: KeyboardEvent, node: TreeNode, level: TreeLevel): void => {
    const keys = getRtlKeys(i18n.dir());

    handleActivationKey(event, node, level, toggleAgent, toggleProject);
    handleExpansionKey(event, node, level, keys, isAgentExpanded, isProjectExpanded, toggleAgent, toggleProject);
  };

  if (projectsStatus === 'loading') {
    return (
      <ul role="tree" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" data-tree>
        <li className="flex justify-center py-3" role="treeitem" aria-level={1} aria-selected="false">
          <Spinner />
        </li>
      </ul>
    );
  }

  if (tree.length === 0) {
    return (
      <ul role="tree" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" data-tree>
        <li className="flex justify-center py-3" role="treeitem" aria-level={1} aria-selected="false">
          <span className="text-sm text-muted-foreground">No projects</span>
        </li>
      </ul>
    );
  }

  const renderAgent = (agent: TreeAgent) => {
    const agentExpanded = isAgentExpanded(agent.agent);
    const agentMatches = filterMatches(textFilter, agent.matchesFilter);

    if (!agentMatches) {
      return null;
    }

    return (
      <li key={agent.agent} role="treeitem" aria-level={1} aria-selected="false">
        <TreeRow
          node={agent}
          level="agent"
          expanded={agentExpanded}
          selected={false}
          loading={false}
          nowMs={nowMs}
          onSelect={() => {
            return undefined;
          }}
          onContextMenu={() => {
            return undefined;
          }}
          onKeyDown={(event) => {
            handleKeyDown(event, agent, 'agent');
          }}
        />
        {agentExpanded && (
          <ProjectList
            agent={agent}
            filterMatches={(matchesFilter) => {
              return filterMatches(textFilter, matchesFilter);
            }}
            isProjectExpanded={(projectId) => {
              return isProjectExpanded(agent.agent, projectId);
            }}
            isProjectLoading={(projectId) => {
              return isProjectLoading(agent.agent, projectId);
            }}
            nowMs={nowMs}
            onOpenMenu={(event, project) => {
              onOpenMenu(event, {
                kind: 'project',
                project,
              });
            }}
            onKeyDown={handleKeyDown}
            renderSessionList={(project) => {
              return (
                <SessionList
                  project={project}
                  selectedFilePath={selectedFilePath}
                  selectionMode={selectionMode}
                  selectedSessionPaths={selectedSessionPaths}
                  nowMs={nowMs}
                  onSessionSelect={onSessionSelect}
                  onOpenMenu={(event, session) => {
                    onOpenMenu(event, {
                      kind: 'session',
                      session,
                    });
                  }}
                  onKeyDown={handleKeyDown}
                  sessionsStatus={sessionsStatus}
                />
              );
            }}
          />
        )}
      </li>
    );
  };

  return (
    <ul role="tree" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" data-tree>
      {tree.map(renderAgent)}
    </ul>
  );
};
