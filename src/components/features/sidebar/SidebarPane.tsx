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
import { appConfig } from '@config/appConfig';
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

import {
  AgentFilterBar,
  ConfirmDeleteDialog,
  ConfirmDeleteProjectDialog,
  ProjectTree,
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
  readonly nowMs: number;
  readonly onSelectProject: (project: ProjectSummary) => void;
  readonly onSelectSession: (session: SessionSummary) => void;
  readonly onDeleteProject: (project: ProjectSummary) => Promise<void>;
  readonly onRenameSession: (session: SessionSummary, title: string) => Promise<void>;
  readonly onDeleteSession: (session: SessionSummary) => Promise<void>;
}

const MIN_PROJECTS_HEIGHT = 160;
const MAX_PROJECTS_HEIGHT = 640;
const DEFAULT_PROJECTS_HEIGHT = 300;

const initialProjectsHeight = (): number => {
  const stored = Number(localStorage.getItem(projectsPaneStorageKey));

  return Number.isFinite(stored) && stored >= MIN_PROJECTS_HEIGHT
    ? Math.min(stored, MAX_PROJECTS_HEIGHT)
    : DEFAULT_PROJECTS_HEIGHT;
};

export const SidebarPane: FC<SidebarPaneProps> = ({
  projects,
  projectsStatus,
  selectedProject,
  sessions,
  sessionsStatus,
  selectedFilePath,
  nowMs,
  onSelectProject,
  onSelectSession,
  onDeleteProject,
  onRenameSession,
  onDeleteSession,
}) => {
  const { t, i18n } = useTranslation('sidebar');
  const [projectFilter, setProjectFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [projectsHeight, setProjectsHeight] = useState(initialProjectsHeight);
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

  const visibleSessions = useMemo(() => {
    const needle = sessionFilter.trim().toLowerCase();

    return needle.length === 0
      ? sessions
      : sessions.filter((session) => {
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

  const projectCount = useMemo(() => {
    return new Set(projects.map((project) => {
      return project.actualPath ?? `name:${project.name}`;
    })).size;
  }, [projects]);

  const sessionCount = useMemo(() => {
    return projects.reduce((total, project) => {
      return total + project.sessionCount;
    }, 0);
  }, [projects]);

  const allSelectableSelected = selectableSessions.length > 0
    && selectableSessions.every((session) => {
      return selectedSessionPaths.includes(session.filePath);
    });

  useEffect(() => {
    localStorage.setItem(projectsPaneStorageKey, String(projectsHeight));
  }, [projectsHeight]);

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
      return current.includes(session.filePath)
        ? current.filter((filePath) => {
            return filePath !== session.filePath;
          })
        : [...current, session.filePath];
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
    <aside className="flex min-h-0 w-full flex-col overflow-hidden bg-card/80" data-sidebar>
      <section className="flex min-h-40 shrink-0 flex-col" style={{ height: projectsHeight }}>
        <SectionHeader
          icon={<FolderClosed className="size-3.5" />}
          label={t('projects')}
          action={(
            <AgentFilterBar
              active={activeAgents}
              available={availableAgents}
              counts={agentCounts}
              onChange={setActiveAgents}
            />
          )}
        />
        <div className="shrink-0 px-3 pb-2">
          <TextInput
            value={projectFilter}
            onInput={setProjectFilter}
            label={t('filterProjects')}
            placeholder={t('filterProjects')}
            className="h-9 px-3"
          />
        </div>
        <ProjectTree
          projects={projects}
          projectsStatus={projectsStatus}
          agentFilter={activeAgents}
          textFilter={projectFilter}
          selectedProject={selectedProject}
          nowMs={nowMs}
          onSelectProject={(project) => {
            exitSelectionMode();
            onSelectProject(project);
          }}
          onOpenMenu={(event, project) => {
            openMenu(event, {
              kind: 'project',
              project,
            });
          }}
        />
      </section>

      <PaneDivider
        label={t('resize')}
        value={projectsHeight}
        min={MIN_PROJECTS_HEIGHT}
        max={MAX_PROJECTS_HEIGHT}
        orientation="vertical"
        onResize={(delta) => {
          setProjectsHeight((height) => {
            return Math.min(Math.max(height + delta, MIN_PROJECTS_HEIGHT), MAX_PROJECTS_HEIGHT);
          });
        }}
      />

      <section className="flex min-h-0 flex-1 flex-col">
        <SectionHeader
          icon={<MessagesSquare className="size-3.5" />}
          label={selectedProject == null
            ? t('sessions')
            : `${agentOption(selectedProject.agent).label} · ${selectedProject.name}`}
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
        <div className="shrink-0 px-3 pb-2">
          <TextInput
            value={sessionFilter}
            onInput={setSessionFilter}
            label={t('filterSessions')}
            placeholder={t('filterSessions')}
            disabled={selectedProject == null}
            className="h-9 px-3"
          />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {visibleSessions.map((session) => {
            const active = session.filePath === selectedFilePath;
            const canDelete = agentOption(session.agent).canDelete;
            const selectedForDelete = selectedSessionPaths.includes(session.filePath);
            const title = session.title ?? session.summary ?? session.preview ?? session.id;

            return (
              <li key={session.filePath}>
                <button
                  type="button"
                  onClick={() => {
                    if (selectionMode) {
                      toggleSessionSelection(session);
                    }
                    else {
                      onSelectSession(session);
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
                  className={cn('sidebar-row', (selectedForDelete || (!selectionMode && active)) && `
                    is-active
                  `)}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {selectionMode && (selectedForDelete
                      ? <CheckSquare2 className="size-4 shrink-0 text-primary" />
                      : (
                          <Square className="
                            size-4 shrink-0 text-muted-foreground
                          "
                          />
                        ))}
                    <span className="
                      block min-w-0 truncate text-sm font-medium text-foreground
                    "
                    >
                      {title}
                    </span>
                  </span>
                  <span className="
                    mt-1 flex items-center gap-2 text-xs text-muted-foreground
                  "
                  >
                    <span>{formatTimeAgo(session.lastTimestampMs, nowMs, i18n.language)}</span>
                    <span>{t('messageCount', { count: session.messageCount })}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {sessionsStatus === 'loading' && (
            <li className="flex justify-center py-4">
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
          {sessionsStatus === 'ready' && selectedProject != null && sessions.length === 0
            && sessionFilter.trim().length === 0 && (
            <EmptyState
              icon={<MessagesSquare className="size-8" />}
              title={t('noSessionsYet')}
              hint={t('noStoredSessions')}
            />
          )}
          {sessionsStatus === 'ready' && selectedProject != null && visibleSessions.length === 0
            && (sessions.length > 0 || sessionFilter.trim().length > 0) && (
            <EmptyState
              icon={<Search className="size-8" />}
              title={t('noSessionsMatch')}
              hint={t('adjustFilter')}
            />
          )}
        </ul>
      </section>

      {!selectionMode && (
        <footer className="sidebar-status">
          <span>{`v${appConfig.version}`}</span>
          <span>{t('projectCount', { count: projectCount })}</span>
          <span>{t('sessionCount', { count: sessionCount })}</span>
        </footer>
      )}
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
