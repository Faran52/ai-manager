import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import {
  CheckSquare2,
  ChevronDown,
  FolderClosed,
  Layers,
  MessagesSquare,
  Search,
  Square,
} from 'lucide-react';

import { agentOption } from '@config/agents';
import { appConfig } from '@config/appConfig';
import {
  projectsDrawerStorageKey,
  projectsPaneStorageKey,
  sessionsListStorageKey,
  sidebarWidthStorageKey,
} from '@config/storageKeys';

import { createArchive } from '@lib/apis/apiClient';
import { saveTextFile } from '@utils/browserFilesUtils';
import { cn } from '@utils/cnUtils';
import { toErrorMessage } from '@utils/errorUtils';
import { formatTimeAgo } from '@utils/formatUtils';

import {
  EmptyState,
  PaneDivider,
  SectionHeader,
  Spinner,
  TextInput,
  Toast,
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
import { AllProjectsCard } from './partials/AllProjectsCard';
import { CollapsedStrip } from './partials/CollapsedStrip';
import { PanelToggle } from './partials/PanelToggle';
import { exportSessions } from './utils/bulkExportUtils';
import { buildProjectTree } from './utils/projectTreeUtils';
import { buildSessionThreads } from './utils/sessionThreadUtils';

import type { AgentId } from '@config/agents';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { PopupPosition } from '@ui/index';
import type {
  FC,
  MouseEvent,
  ReactNode,
} from 'react';
import type { SidebarMenuTarget } from './partials';
import type { StripItem } from './partials/CollapsedStrip';

export interface SidebarPaneProps {
  readonly projects: readonly ProjectSummary[];
  readonly projectsStatus: 'loading' | 'ready' | 'error';
  readonly selectedProject: ProjectSummary | null;
  readonly sessions: readonly SessionSummary[];
  readonly sessionsStatus: 'loading' | 'ready' | 'error';
  readonly selectedFilePath: string | null;
  readonly nowMs: number;
  readonly onSelectProject: (project: ProjectSummary) => void;
  // True while the report is reading every project rather than one.
  readonly wholeMachine: boolean;
  readonly onSelectAllProjects: () => void;
  readonly onSelectSession: (session: SessionSummary) => void;
  readonly onDeleteProject: (project: ProjectSummary) => Promise<void>;
  readonly onRenameSession: (session: SessionSummary, title: string) => Promise<void>;
  readonly onDeleteSession: (session: SessionSummary) => Promise<void>;
}

const MIN_PROJECTS_WIDTH = 200;
const MAX_PROJECTS_WIDTH = 480;
const DEFAULT_PROJECTS_WIDTH = 260;
const MIN_SESSIONS_WIDTH = 280;
const MAX_SESSIONS_WIDTH = 520;
const DEFAULT_SESSIONS_WIDTH = 320;

// A session is named by whatever it carries, and every agent carries a different one of these.
const titleOf = (session: SessionSummary): string => {
  return session.title ?? session.summary ?? session.preview ?? session.id;
};

const storedWidth = (key: string, fallback: number, min: number, max: number): number => {
  const stored = Number(localStorage.getItem(key));

  return Number.isFinite(stored) && stored >= min ? Math.min(stored, max) : fallback;
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
  wholeMachine,
  onSelectAllProjects,
  onSelectSession,
  onDeleteProject,
  onRenameSession,
  onDeleteSession,
}) => {
  const { t, i18n } = useTranslation('sidebar');
  const [projectFilter, setProjectFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [projectsWidth, setProjectsWidth] = useState(() => {
    return storedWidth(
      projectsPaneStorageKey,
      DEFAULT_PROJECTS_WIDTH,
      MIN_PROJECTS_WIDTH,
      MAX_PROJECTS_WIDTH,
    );
  });
  const [sessionsWidth, setSessionsWidth] = useState(() => {
    return storedWidth(
      sidebarWidthStorageKey,
      DEFAULT_SESSIONS_WIDTH,
      MIN_SESSIONS_WIDTH,
      MAX_SESSIONS_WIDTH,
    );
  });
  const [projectsOpen, setProjectsOpen] = useState(() => {
    return localStorage.getItem(projectsDrawerStorageKey) !== 'false';
  });
  const [sessionsOpen, setSessionsOpen] = useState(() => {
    return localStorage.getItem(sessionsListStorageKey) !== 'false';
  });
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
  const [expandedThreads, setExpandedThreads] = useState<readonly string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
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
          const haystack = [
            session.title,
            session.summary,
            session.preview,
            session.gitBranch,
          ].join(' ').toLowerCase();

          return haystack.includes(needle);
        });
  }, [sessionFilter, sessions]);

  /**
   * Resuming or compacting a session writes a fresh transcript, so one piece of
   * work arrives as several files. They are shown as one row that opens to its
   * parts rather than as unrelated neighbours in the list.
   */
  const sessionRows = useMemo(() => {
    return buildSessionThreads(visibleSessions).flatMap((thread) => {
      const head = {
        session: thread.head,
        threadKey: thread.key,
        partCount: thread.parts.length,
        messageCount: thread.messageCount,
        continuation: false,
      };

      if (thread.parts.length === 1 || !expandedThreads.includes(thread.key)) {
        return [head];
      }

      return [head, ...thread.parts.slice(1).map((session) => {
        return {
          session,
          threadKey: thread.key,
          partCount: 1,
          messageCount: session.messageCount,
          continuation: true,
        };
      })];
    });
  }, [expandedThreads, visibleSessions]);

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

  /*
   * Both actions add rather than remove, so neither asks for confirmation the
   * way deleting does. Archiving names the exact sessions instead of sweeping
   * everything the agents hold.
   */
  const toggleThread = (key: string): void => {
    setExpandedThreads((current) => {
      return current.includes(key)
        ? current.filter((open) => {
            return open !== key;
          })
        : [...current, key];
    });
  };

  const archiveSelected = (): void => {
    setBulkBusy(true);
    void (async (): Promise<void> => {
      try {
        const { archive } = await createArchive({
          note: t('bulkArchiveNote'),
          sessionKeys: selectedSessions.map((session) => {
            return `${session.agent}:${session.actualSessionId}`;
          }),
        });

        setBulkNotice(t('bulkArchived', { count: archive.sessionCount }));
      }
      catch (cause) {
        setBulkNotice(toErrorMessage(cause));
      }
      finally {
        setBulkBusy(false);
      }
    })();
  };

  const exportSelected = (): void => {
    setBulkBusy(true);
    void (async (): Promise<void> => {
      const result = await exportSessions(selectedSessions, selectedProject?.name ?? '', Date.now());

      if (result.markdown.length > 0) {
        saveTextFile(`${selectedProject?.name ?? 'sessions'}.md`, result.markdown, 'text/markdown');
      }

      setBulkNotice(result.failed > 0 ? t('bulkExportFailed') : null);
      setBulkBusy(false);
    })();
  };

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
    localStorage.setItem(projectsPaneStorageKey, String(projectsWidth));
    localStorage.setItem(sidebarWidthStorageKey, String(sessionsWidth));
    localStorage.setItem(projectsDrawerStorageKey, String(projectsOpen));
    localStorage.setItem(sessionsListStorageKey, String(sessionsOpen));
  }, [projectsOpen, projectsWidth, sessionsOpen, sessionsWidth]);

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

  /*
   * A strip reads the same filtered list its open column does, so folding a
   * column away never changes what is in it.
   */
  const projectStripItems = (): readonly StripItem[] => {
    return [
      {
        id: 'all-projects',
        label: t('allProjects'),
        mark: <Layers className="size-3.5" />,
        selected: wholeMachine,
        onSelect: () => {
          exitSelectionMode();
          onSelectAllProjects();
        },
      },
      ...buildProjectTree(projects, {
        agentFilter: activeAgents,
        textFilter: projectFilter,
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
                exitSelectionMode();
                onSelectProject(branch.source);
              },
            }]
          : [];
      }),
    ];
  };

  const sessionStripItems = (): readonly StripItem[] => {
    return sessionRows.map((row) => {
      return {
        id: row.session.filePath,
        label: titleOf(row.session),
        agent: row.session.agent,
        selected: row.session.filePath === selectedFilePath,
        onSelect: (): void => {
          onSelectSession(row.session);
        },
      };
    });
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
    <aside className="flex min-h-0 shrink-0 flex-col overflow-hidden bg-card/80" data-sidebar>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {projectsOpen
          ? (
              <>
                <section className="flex min-h-0 shrink-0 flex-col" style={{ width: projectsWidth }}>
                  <SectionHeader
                    icon={<FolderClosed className="size-3.5" />}
                    label={t('projects')}
                    action={(
                      <span className="flex items-center gap-1">
                        <AgentFilterBar
                          active={activeAgents}
                          available={availableAgents}
                          counts={agentCounts}
                          onChange={setActiveAgents}
                        />
                        <PanelToggle
                          label={t('hideProjects')}
                          onToggle={() => {
                            setProjectsOpen(false);
                          }}
                        />
                      </span>
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
                  {/* Pinned above the scroller: a scope control that scrolls
                      away with the list it scopes has become a list item. */}
                  <AllProjectsCard
                    projects={projects}
                    selected={wholeMachine}
                    onSelect={() => {
                      exitSelectionMode();
                      onSelectAllProjects();
                    }}
                  />
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
                  value={projectsWidth}
                  min={MIN_PROJECTS_WIDTH}
                  max={MAX_PROJECTS_WIDTH}
                  orientation="horizontal"
                  onResize={(delta) => {
                    setProjectsWidth((width) => {
                      return Math.min(
                        Math.max(width + delta, MIN_PROJECTS_WIDTH),
                        MAX_PROJECTS_WIDTH,
                      );
                    });
                  }}
                />
              </>
            )
          : (
              <CollapsedStrip
                expandLabel={t('showProjects')}
                listLabel={t('projects')}
                items={projectStripItems()}
                onExpand={() => {
                  setProjectsOpen(true);
                }}
              />
            )}
        {sessionsOpen
          ? (
              <>
                <section className="flex min-h-0 shrink-0 flex-col" style={{ width: sessionsWidth }}>
                  <SectionHeader
                    icon={<MessagesSquare className="size-3.5" />}
                    label={selectedProject == null
                      ? t('sessions')
                      : `${agentOption(selectedProject.agent).label} · ${selectedProject.name}`}
                    action={(
                      <span className="flex items-center gap-1">
                        {sessionHeaderAction}
                        <PanelToggle
                          label={t('hideSessions')}
                          onToggle={() => {
                            setSessionsOpen(false);
                          }}
                        />
                      </span>
                    )}
                  />
                  {selectionMode && (
                    <SessionSelectionBar
                      selectedCount={selectedSessions.length}
                      allSelected={allSelectableSelected}
                      onToggleAll={toggleAllSessions}
                      busy={bulkBusy}
                      onDelete={() => {
                        setDeleteTargets(selectedSessions);
                      }}
                      onArchive={archiveSelected}
                      onExport={exportSelected}
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
                    {sessionRows.map((row) => {
                      const session = row.session;
                      const active = session.filePath === selectedFilePath;
                      const canDelete = agentOption(session.agent).canDelete;
                      const selectedForDelete = selectedSessionPaths.includes(session.filePath);
                      const title = titleOf(session);
                      const threaded = row.partCount > 1;
                      const open = expandedThreads.includes(row.threadKey);

                      return (
                        <li
                          key={session.filePath}
                          className={cn(row.continuation && 'ps-4')}
                        >
                          {threaded && (
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={t('threadParts', { count: row.partCount })}
                              data-thread-toggle={row.threadKey}
                              onClick={() => {
                                toggleThread(row.threadKey);
                              }}
                              className="
                                flex w-full items-center gap-1.5 px-2 pt-1
                                text-body text-muted-foreground
                                hover:text-foreground
                              "
                            >
                              <ChevronDown className={cn(`
                                size-3 transition-transform
                              `, !open && '-rotate-90')}
                              />
                              {t('threadParts', { count: row.partCount })}
                            </button>
                          )}
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
                                ? (
                                    <CheckSquare2 className="
                                      size-4 shrink-0 text-primary
                                    "
                                    />
                                  )
                                : (
                                    <Square className="
                                      size-4 shrink-0 text-muted-foreground
                                    "
                                    />
                                  ))}
                              <span className="
                                block min-w-0 truncate text-sm font-medium
                                text-foreground
                              "
                              >
                                {title}
                              </span>
                            </span>
                            <span className="
                              mt-1 flex items-center gap-2 text-xs
                              text-muted-foreground
                            "
                            >
                              <span>{formatTimeAgo(session.lastTimestampMs, nowMs, i18n.language)}</span>
                              <span>{t('messageCount', { count: row.messageCount })}</span>
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
                <PaneDivider
                  label={t('resizeSidebar')}
                  value={sessionsWidth}
                  min={MIN_SESSIONS_WIDTH}
                  max={MAX_SESSIONS_WIDTH}
                  orientation="horizontal"
                  onResize={(delta) => {
                    setSessionsWidth((width) => {
                      return Math.min(
                        Math.max(width + delta, MIN_SESSIONS_WIDTH),
                        MAX_SESSIONS_WIDTH,
                      );
                    });
                  }}
                />
              </>
            )
          : (
              <CollapsedStrip
                expandLabel={t('showSessions')}
                listLabel={t('sessions')}
                items={sessionStripItems()}
                onExpand={() => {
                  setSessionsOpen(true);
                }}
              />
            )}
      </div>

      {/* Folded to two strips the sidebar is 112px wide, which is no place for
          a status line, and the counts are on the All projects card anyway. */}
      {!selectionMode && (projectsOpen || sessionsOpen) && (
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
      <Toast message={bulkNotice} />
      {copiedLabel.length > 0 && <span className="sr-only" role="status">{copiedLabel}</span>}
      {mutationError.length > 0 && <span className="sr-only" role="alert">{mutationError}</span>}
    </aside>
  );
};
