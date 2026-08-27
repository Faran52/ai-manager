import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import {
  CheckSquare2,
  FolderClosed,
  MessagesSquare,
  Search,
  Square,
} from 'lucide-react';

import { agentOption } from '@config/agents';
import { projectsPaneStorageKey } from '@config/storageKeys';

import { cn } from '@utils/cnUtils';
import { toErrorMessage } from '@utils/errorUtils';
import { formatTimeAgo } from '@utils/formatUtils';

import {
  EmptyState,
  PaneDivider,
  SectionHeader,
  Spinner,
  TextInput,
} from '@ui/index';
import { AgentTag } from '@features/agent-tag';

import {
  AgentFilterBar,
  ConfirmDeleteDialog,
  ConfirmDeleteProjectDialog,
  RenameSessionDialog,
  SessionSelectionBar,
  SidebarContextMenu,
} from './partials';

import type { AgentId } from '@config/agents';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { PopupPosition } from '@ui/index';
import type {
  FC,
  MouseEvent,
  ReactNode,
} from 'react';
import type { SidebarMenuTarget } from './partials';

export interface SidebarPaneProps {
  readonly projects: readonly ProjectSummary[];
  readonly projectsStatus: 'loading' | 'ready' | 'error';
  readonly selectedProject: ProjectSummary | null;
  readonly sessions: readonly SessionSummary[];
  readonly sessionsStatus: 'loading' | 'ready' | 'error';
  readonly selectedFilePath: string | null;
  readonly onSelectProject: (project: ProjectSummary) => void;
  readonly onSelectSession: (filePath: string) => void;
  readonly onDeleteProject: (project: ProjectSummary) => Promise<void>;
  readonly onRenameSession: (session: SessionSummary, title: string) => Promise<void>;
  readonly onDeleteSession: (session: SessionSummary) => Promise<void>;
  readonly nowMs: number;
}

const MIN_PANE = 120;
const MAX_PANE = 640;

export const SidebarPane: FC<SidebarPaneProps> = ({
  projects,
  projectsStatus,
  selectedProject,
  sessions,
  sessionsStatus,
  selectedFilePath,
  onSelectProject,
  onSelectSession,
  onDeleteProject,
  onRenameSession,
  onDeleteSession,
  nowMs,
}) => {
  const { t, i18n } = useTranslation('sidebar');
  const [projectFilter, setProjectFilter] = useState('');
  const [projectsHeight, setProjectsHeight] = useState(() => {
    const stored = Number(localStorage.getItem(projectsPaneStorageKey));

    return Number.isFinite(stored) && stored >= MIN_PANE ? stored : 260;
  });

  useEffect(() => {
    localStorage.setItem(projectsPaneStorageKey, String(projectsHeight));
  }, [projectsHeight]);
  const [sessionFilter, setSessionFilter] = useState('');
  const [menuTarget, setMenuTarget] = useState<SidebarMenuTarget | null>(null);
  const [menuPosition, setMenuPosition] = useState<PopupPosition>({
    x: 0,
    y: 0,
  });
  const [copiedLabel, setCopiedLabel] = useState('');
  const [activeAgents, setActiveAgents] = useState<readonly AgentId[]>([]);
  const [renameTarget, setRenameTarget] = useState<SessionSummary | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<ProjectSummary | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<readonly SessionSummary[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSessionPaths, setSelectedSessionPaths] = useState<readonly string[]>([]);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [mutationError, setMutationError] = useState('');

  const availableAgents = useMemo(() => {
    return [...new Set(projects.map((project) => {
      return project.agent;
    }))];
  }, [projects]);
  const agentCounts = useMemo(() => {
    const counts = new Map<AgentId, number>();

    for (const project of projects) {
      counts.set(project.agent, (counts.get(project.agent) ?? 0) + 1);
    }

    return counts;
  }, [projects]);

  const visibleProjects = useMemo(() => {
    const needle = projectFilter.trim().toLowerCase();

    return projects.filter((project) => {
      return (activeAgents.length === 0 || activeAgents.includes(project.agent))
        && (needle.length === 0 || project.name.toLowerCase().includes(needle));
    });
  }, [activeAgents, projectFilter, projects]);

  const visibleSessions = useMemo(() => {
    const needle = sessionFilter.trim().toLowerCase();

    if (needle.length === 0) {
      return sessions;
    }

    return sessions.filter((session) => {
      const haystack = `${session.title ?? ''} ${session.summary ?? ''} ${session.preview ?? ''}`.toLowerCase();

      return haystack.includes(needle);
    });
  }, [sessionFilter, sessions]);

  const selectableSessions = useMemo(() => {
    return visibleSessions.filter((session) => {
      return agentOption(session.agent).canDelete;
    });
  }, [visibleSessions]);

  const selectedSessions = useMemo(() => {
    return sessions.filter((session) => {
      return selectedSessionPaths.includes(session.filePath);
    });
  }, [selectedSessionPaths, sessions]);

  const allSelectableSelected = selectableSessions.length > 0
    && selectableSessions.every((session) => {
      return selectedSessionPaths.includes(session.filePath);
    });

  useEffect(() => {
    if (!selectionMode || deleteTargets.length > 0) {
      return undefined;
    }

    const cancelSelection = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setSelectionMode(false);
        setSelectedSessionPaths([]);
      }
    };

    window.addEventListener('keydown', cancelSelection);

    return () => {
      window.removeEventListener('keydown', cancelSelection);
    };
  }, [deleteTargets.length, selectionMode]);

  const openMenu = (event: MouseEvent, target: SidebarMenuTarget): void => {
    event.preventDefault();
    setMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
    setMenuTarget(target);
  };

  const runRename = async (session: SessionSummary, title: string): Promise<void> => {
    setMutationBusy(true);
    setMutationError('');

    try {
      await onRenameSession(session, title);
      setRenameTarget(null);
    }
    catch (cause: unknown) {
      setMutationError(toErrorMessage(cause));
    }
    finally {
      setMutationBusy(false);
    }
  };

  const runDelete = async (targets: readonly SessionSummary[]): Promise<void> => {
    setMutationBusy(true);
    setMutationError('');

    try {
      for (const session of targets) {
        await onDeleteSession(session);
      }

      setDeleteTargets([]);
      setSelectionMode(false);
      setSelectedSessionPaths([]);
    }
    catch (cause: unknown) {
      setMutationError(toErrorMessage(cause));
    }
    finally {
      setMutationBusy(false);
    }
  };

  const runDeleteProject = async (project: ProjectSummary): Promise<void> => {
    setMutationBusy(true);
    setMutationError('');

    try {
      await onDeleteProject(project);
      setDeleteProjectTarget(null);
    }
    catch (cause: unknown) {
      setMutationError(toErrorMessage(cause));
    }
    finally {
      setMutationBusy(false);
    }
  };

  const exitSelectionMode = (): void => {
    setSelectionMode(false);
    setSelectedSessionPaths([]);
  };

  const toggleSessionSelection = (session: SessionSummary): void => {
    setSelectedSessionPaths((current) => {
      if (current.includes(session.filePath)) {
        return current.filter((filePath) => {
          return filePath !== session.filePath;
        });
      }

      return [...current, session.filePath];
    });
  };

  const toggleAllSessions = (): void => {
    setSelectedSessionPaths(allSelectableSelected
      ? []
      : selectableSessions.map((session) => {
          return session.filePath;
        }));
  };

  let sessionHeaderAction: ReactNode;

  if (selectionMode) {
    sessionHeaderAction = (
      <button
        type="button"
        aria-label={t('cancelSelection')}
        onClick={exitSelectionMode}
        className="sidebar-section-action"
      >
        {t('cancel', { ns: 'common' })}
      </button>
    );
  }
  else if (selectableSessions.length > 0) {
    sessionHeaderAction = (
      <button
        type="button"
        aria-label={t('selectSessions')}
        onClick={() => {
          setMenuTarget(null);
          setSelectionMode(true);
        }}
        className="sidebar-section-action"
      >
        {t('select')}
      </button>
    );
  }

  return (
    <aside
      className="
        flex min-h-0 w-full flex-col overflow-hidden border-r border-border
        bg-card/80
      "
      data-sidebar
    >
      <section className="flex min-h-32 shrink-0 flex-col" style={{ height: projectsHeight }}>
        <SectionHeader icon={<FolderClosed className="size-3.5" />} label={t('projects')} />
        <AgentFilterBar
          active={activeAgents}
          available={availableAgents}
          counts={agentCounts}
          onChange={setActiveAgents}
        />
        <div className="shrink-0 px-2 pb-1.5">
          <TextInput
            value={projectFilter}
            onInput={setProjectFilter}
            label={t('filterProjects')}
            placeholder={t('filterProjects')}
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {visibleProjects.map((project) => {
            const active = project.id === selectedProject?.id && project.agent === selectedProject.agent;

            return (
              <li key={`${project.agent}:${project.id}`}>
                <button
                  type="button"
                  onClick={() => {
                    exitSelectionMode();
                    onSelectProject(project);
                  }}
                  onContextMenu={(event) => {
                    openMenu(event, {
                      kind: 'project',
                      project,
                    });
                  }}
                  aria-current={active}
                  data-project-item={project.id}
                  className={cn(
                    'sidebar-row',
                    active
                      ? 'bg-primary/15 ring-1 ring-primary/40 ring-inset'
                      : 'hover:bg-accent',
                  )}
                >
                  <span className="
                    block truncate text-sm font-medium text-foreground
                  "
                  >
                    {project.name}
                  </span>
                  <span className="
                    mt-0.5 flex min-w-0 items-center gap-2 overflow-hidden
                    text-[11px] text-muted-foreground
                  "
                  >
                    <span className="shrink-0">
                      {t('sessionCount', { count: project.sessionCount })}
                    </span>
                    <AgentTag agent={project.agent} />
                    <span className="shrink-0">{formatTimeAgo(project.lastActivityMs, nowMs, i18n.language)}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {projectsStatus === 'loading' && (
            <li className="flex justify-center py-3">
              <Spinner />
            </li>
          )}
        </ul>
      </section>

      <PaneDivider
        label={t('resize')}
        value={projectsHeight}
        min={MIN_PANE}
        max={MAX_PANE}
        onResize={(deltaY: number) => {
          setProjectsHeight((height) => {
            return Math.min(Math.max(height + deltaY, MIN_PANE), MAX_PANE);
          });
        }}
      />

      <section className="flex min-h-0 flex-1 flex-col">
        <SectionHeader
          icon={<MessagesSquare className="size-3.5" />}
          label={t('sessions')}
          action={sessionHeaderAction}
        />
        {selectionMode && (
          <SessionSelectionBar
            selectedCount={selectedSessions.length}
            allSelected={allSelectableSelected}
            onToggleAll={toggleAllSessions}
            onDelete={() => {
              setDeleteTargets(selectedSessions);
            }}
          />
        )}
        <div className="shrink-0 px-2 pb-1.5">
          <TextInput
            value={sessionFilter}
            onInput={setSessionFilter}
            label={t('filterSessions')}
            placeholder={t('filterSessions')}
            disabled={selectedProject == null}
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {visibleSessions.map((session) => {
            const active = session.filePath === selectedFilePath;
            const canDelete = agentOption(session.agent).canDelete;
            const selectedForDelete = selectedSessionPaths.includes(session.filePath);
            const title = session.title ?? session.summary ?? session.preview ?? session.id;
            let rowStateClass = 'hover:bg-accent';

            if (selectionMode && selectedForDelete) {
              rowStateClass = 'bg-primary/15 ring-1 ring-primary/40 ring-inset';
            }
            else if (!selectionMode && active) {
              rowStateClass = `
                bg-primary/15 ring-1 ring-primary/40 ring-inset
              `;
            }

            return (
              <li key={session.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (selectionMode) {
                      toggleSessionSelection(session);
                    }
                    else {
                      onSelectSession(session.filePath);
                    }
                  }}
                  disabled={selectionMode && !canDelete}
                  onContextMenu={(event) => {
                    if (selectionMode) {
                      event.preventDefault();
                    }
                    else {
                      openMenu(event, {
                        kind: 'session',
                        session,
                      });
                    }
                  }}
                  aria-current={selectionMode ? undefined : active}
                  aria-pressed={selectionMode ? selectedForDelete : undefined}
                  data-session-item={session.filePath}
                  data-selected={selectionMode ? selectedForDelete : undefined}
                  className={cn('sidebar-row', rowStateClass)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {selectionMode && (selectedForDelete
                      ? (
                          <CheckSquare2 className="
                            size-3.5 shrink-0 text-primary
                          "
                          />
                        )
                      : (
                          <Square className="
                            size-3.5 shrink-0 text-muted-foreground
                          "
                          />
                        ))}
                    <span className="
                      block min-w-0 truncate text-sm text-foreground
                    "
                    >
                      {title}
                    </span>
                  </span>
                  <span className="
                    mt-0.5 flex items-center gap-2 text-[11px]
                    text-muted-foreground
                  "
                  >
                    <span>{formatTimeAgo(session.lastTimestampMs, nowMs, i18n.language)}</span>
                    <span>
                      {t('messageCount', { count: session.messageCount })}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {sessionsStatus === 'loading' && (
            <li className="flex justify-center py-3">
              <Spinner />
            </li>
          )}
          {sessionsStatus === 'ready' && selectedProject == null && (
            <EmptyState
              icon={<FolderClosed className="size-8" />}
              title={t('selectProject')}
              hint={t('selectProjectHint')}
            />
          )}
          {sessionsStatus === 'ready'
            && selectedProject != null
            && sessions.length === 0
            && sessionFilter.trim().length === 0 && (
            <EmptyState
              icon={<MessagesSquare className="size-8" />}
              title={t('noSessionsYet')}
              hint={t('noStoredSessions')}
            />
          )}
          {sessionsStatus === 'ready'
            && selectedProject != null
            && visibleSessions.length === 0
            && (sessions.length > 0 || sessionFilter.trim().length > 0) && (
            <EmptyState
              icon={<Search className="size-8" />}
              title={t('noSessionsMatch')}
              hint={t('adjustFilter')}
            />
          )}
        </ul>
      </section>
      {menuTarget != null && !selectionMode && (
        <SidebarContextMenu
          target={menuTarget}
          position={menuPosition}
          onClose={() => {
            setMenuTarget(null);
          }}
          onCopied={setCopiedLabel}
          onDeleteProject={setDeleteProjectTarget}
          onRenameSession={setRenameTarget}
          onDeleteSession={(session) => {
            setDeleteTargets([session]);
          }}
        />
      )}
      <RenameSessionDialog
        open={renameTarget != null}
        session={renameTarget}
        busy={mutationBusy}
        onClose={() => {
          setRenameTarget(null);
        }}
        onConfirm={(session, title) => {
          void runRename(session, title);
        }}
      />
      <ConfirmDeleteProjectDialog
        project={deleteProjectTarget}
        busy={mutationBusy}
        onClose={() => {
          setDeleteProjectTarget(null);
        }}
        onConfirm={(project) => {
          void runDeleteProject(project);
        }}
      />
      <ConfirmDeleteDialog
        sessions={deleteTargets}
        busy={mutationBusy}
        onClose={() => {
          setDeleteTargets([]);
        }}
        onConfirm={(targets) => {
          void runDelete(targets);
        }}
      />
      {copiedLabel.length > 0 && <span className="sr-only" role="status">{copiedLabel}</span>}
      {mutationError.length > 0 && <span className="sr-only" role="alert">{mutationError}</span>}
    </aside>
  );
};
