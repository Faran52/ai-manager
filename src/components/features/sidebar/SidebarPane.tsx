import {
  Fragment,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import {
  Check,
  ChevronDown,
  FolderClosed,
  Layers,
  ListChecks,
  MessagesSquare,
  Search,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { agentBadgeLabel, agentOption } from '@config/agents';
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
  AgentMark,
  arriveInSequence,
  collapseTransition,
  controlTransition,
  EmptyState,
  fadeTransition,
  foldTransition,
  PaneDivider,
  SectionHeader,
  Spinner,
  TextInput,
  Tooltip,
  useReducedMotion,
  useToast,
} from '@ui/index';

import {
  ConfirmDeleteDialog,
  ConfirmDeleteProjectDialog,
  ProjectTree,
  RenameSessionDialog,
  SessionSelectionBar,
  SidebarContextMenu,
} from './partials';
import { AllProjectsCard } from './partials/AllProjectsCard';
import { CollapsedStrip } from './partials/CollapsedStrip';
import { FunnelMenu } from './partials/FunnelMenu';
import { PanelToggle } from './partials/PanelToggle';
import { exportSessions } from './utils/bulkExportUtils';
import { withinDateFilter } from './utils/dateFilterUtils';
import { buildProjectTree } from './utils/projectTreeUtils';
import { groupSessionsByRecency } from './utils/sessionGroupUtils';
import { buildSessionThreads, groupThreadRuns } from './utils/sessionThreadUtils';

import type { AgentId } from '@config/agents';
import type { ReportScope } from '@features/history-data';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { PopupPosition } from '@ui/index';
import type {
  FC,
  MouseEvent,
  ReactElement,
  ReactNode,
} from 'react';
import type { SidebarMenuTarget } from './partials';
import type { StripItem } from './partials/CollapsedStrip';
import type { FunnelOrder } from './partials/FunnelMenu';
import type { DateFilter } from './utils/dateFilterUtils';
import type { RecencyBucket } from './utils/sessionGroupUtils';
import type { SessionRow } from './utils/sessionThreadUtils';

export interface SidebarPaneProps {
  readonly projects: readonly ProjectSummary[];
  readonly projectsStatus: 'loading' | 'ready' | 'error';
  // Looked up for a session row's project badge, shown only once sessions can
  // span more than one project (a report agent's own, across every project).
  readonly projectNames: ReadonlyMap<string, string>;
  readonly selectedProject: ProjectSummary | null;
  readonly sessions: readonly SessionSummary[];
  readonly sessionsStatus: 'loading' | 'ready' | 'error';
  readonly selectedFilePath: string | null;
  readonly nowMs: number;
  readonly onSelectProject: (project: ProjectSummary) => void;
  // True while the report is reading every project rather than one.
  readonly wholeMachine: boolean;
  readonly onSelectAllProjects: () => void;
  // The agent (and profile) the All Projects card's report is scoped to,
  // distinct from the Funnel's own multi-select Projects-tree filter below.
  readonly reportScope: ReportScope | null;
  readonly onSelectReportAgent: (agent: AgentId, profile?: string) => void;
  readonly onSelectSession: (session: SessionSummary) => void;
  readonly onDeleteProject: (project: ProjectSummary) => Promise<void>;
  readonly onRenameSession: (session: SessionSummary, title: string) => Promise<void>;
  readonly onDeleteSession: (session: SessionSummary) => Promise<void>;
  /**
   * The session list belongs to the transcript beside it, so it rides along
   * with the Sessions view only. Health and Archive read the projects column
   * alone; folding this away keeps the pane about what it reports.
   */
  readonly showSessions?: boolean;
  // The scope card is pinned above the list where a report can be global.
  readonly showAllProjects?: boolean;
  // Health reads a project as one folder, so its cards carry no agent chips.
  readonly showAgentChips?: boolean;
}

const MIN_PROJECTS_WIDTH = 200;
const MAX_PROJECTS_WIDTH = 480;
const DEFAULT_PROJECTS_WIDTH = 260;
const MIN_SESSIONS_WIDTH = 280;
const MAX_SESSIONS_WIDTH = 520;
const DEFAULT_SESSIONS_WIDTH = 320;
// The width a column folds to: its strip of marks, w-14 in the tailwind scale.
const COLLAPSED_WIDTH = '3.5rem';
// A reduced-motion reader gets the end state with no travel, same as Disclosure.
const INSTANT = { duration: 0 };

// The two faces of the leading gutter: a small pop in and out, cross-faded.
const MARK_SWAP = {
  initial: {
    opacity: 0,
    scale: 0.8,
  },
  animate: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.8,
  },
};

/*
 * Selection mode borrows a row's leading gutter for a checkbox; otherwise it
 * carries the agent circle. The gutter is a fixed size-7 either way, so the
 * two cross-fade in place and nothing beside them shifts.
 */
const LeadMark: FC<{
  readonly agent: AgentId;
  readonly selecting: boolean;
  readonly checked: boolean;
  readonly reduceMotion: boolean;
}> = ({
  agent,
  selecting,
  checked,
  reduceMotion,
}) => {
  const transition = reduceMotion ? INSTANT : controlTransition;

  return (
    <span className="flex size-7 shrink-0 items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        {selecting
          ? (
              <motion.span
                key="check"
                {...MARK_SWAP}
                transition={transition}
                className="sidebar-check"
                data-checked={checked}
                aria-hidden="true"
              >
                <Check className="size-3" strokeWidth={3} />
              </motion.span>
            )
          : (
              <motion.span
                key="mark"
                {...MARK_SWAP}
                transition={transition}
                className="flex"
              >
                <AgentMark agent={agent} className="size-7 text-figure" />
              </motion.span>
            )}
      </AnimatePresence>
    </span>
  );
};

// A session is named by whatever it carries, and every agent carries a different one of these.
const titleOf = (session: SessionSummary): string => {
  return session.title ?? session.summary ?? session.preview ?? session.id;
};

/*
 * The line under the title, only when there is a distinct first message to
 * show: if the row is already named by its summary or preview, printing it
 * twice says nothing.
 */
const previewOf = (session: SessionSummary): string | null => {
  const line = session.summary ?? session.preview;

  return line == null || line === titleOf(session) ? null : line;
};

const BUCKET_LABEL: Record<RecencyBucket, string> = {
  today: 'recencyToday',
  week: 'recencyWeek',
  earlier: 'recencyEarlier',
};

const storedWidth = (key: string, fallback: number, min: number, max: number): number => {
  const stored = Number(localStorage.getItem(key));

  return Number.isFinite(stored) && stored >= min ? Math.min(stored, max) : fallback;
};

export const SidebarPane: FC<SidebarPaneProps> = ({
  projects,
  projectsStatus,
  projectNames,
  selectedProject,
  sessions,
  sessionsStatus,
  selectedFilePath,
  nowMs,
  onSelectProject,
  wholeMachine,
  onSelectAllProjects,
  reportScope,
  onSelectReportAgent,
  onSelectSession,
  onDeleteProject,
  onRenameSession,
  onDeleteSession,
  showSessions = true,
  showAllProjects = true,
  showAgentChips = true,
}) => {
  const { t, i18n } = useTranslation('sidebar');
  const { push: pushToast } = useToast();
  const reduceMotion = useReducedMotion();
  // One disclosure timing for both the thread parts and the selection bar.
  const collapse = reduceMotion ? INSTANT : collapseTransition;
  const [projectFilter, setProjectFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [projectDateFilter, setProjectDateFilter] = useState<DateFilter>('all');
  const [projectOrder, setProjectOrder] = useState<FunnelOrder>('newest');
  const [sessionDateFilter, setSessionDateFilter] = useState<DateFilter>('all');
  const [sessionOrder, setSessionOrder] = useState<FunnelOrder>('newest');
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
  const [collapsedGroups, setCollapsedGroups] = useState<readonly RecencyBucket[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSessionPaths, setSelectedSessionPaths] = useState<readonly string[]>([]);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [mutationError, setMutationError] = useState('');

  const agentCounts = useMemo(() => {
    const counts = new Map<AgentId, number>();

    for (const project of projects) {
      counts.set(project.agent, (counts.get(project.agent) ?? 0) + 1);
    }

    return counts;
  }, [projects]);

  const visibleSessions = useMemo(() => {
    const needle = sessionFilter.trim().toLowerCase();

    return sessions.filter((session) => {
      if (!withinDateFilter(session.lastTimestampMs, sessionDateFilter, nowMs)) {
        return false;
      }

      if (needle.length === 0) {
        return true;
      }

      return [
        session.title,
        session.summary,
        session.preview,
        session.gitBranch,
      ].join(' ').toLowerCase().includes(needle);
    });
  }, [nowMs, sessionDateFilter, sessionFilter, sessions]);

  /**
   * Resuming or compacting a session writes a fresh transcript, so one piece of
   * work arrives as several files. They are shown as one row that opens to its
   * parts rather than as unrelated neighbours in the list.
   */
  const sessionRows = useMemo((): readonly SessionRow[] => {
    return buildSessionThreads(visibleSessions, sessionOrder).flatMap((thread) => {
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
  }, [expandedThreads, sessionOrder, visibleSessions]);

  const sessionGroups = useMemo(() => {
    return groupSessionsByRecency(sessionRows, nowMs);
  }, [nowMs, sessionRows]);

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

  const toggleGroup = (bucket: RecencyBucket): void => {
    setCollapsedGroups((current) => {
      return current.includes(bucket)
        ? current.filter((shut) => {
            return shut !== bucket;
          })
        : [...current, bucket];
    });
  };

  /*
   * Empty means every agent, so the first pick narrows to just that one and
   * clearing the last pick widens back out. The all-projects tallies and the
   * funnel's Agents submenu both drive this.
   */
  const toggleProjectAgent = (agent: AgentId): void => {
    setActiveAgents((current) => {
      if (current.length === 0) {
        return [agent];
      }

      return current.includes(agent)
        ? current.filter((item) => {
            return item !== agent;
          })
        : [...current, agent];
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

        pushToast(t('bulkArchived', { count: archive.sessionCount }));
      }
      catch (cause) {
        pushToast(toErrorMessage(cause), 'error');
      }
      finally {
        setBulkBusy(false);
      }
    })();
  };

  const exportSelected = (): void => {
    setBulkBusy(true);
    void (async (): Promise<void> => {
      /**
       * A project names the export same as always; with none selected, a report
       * agent's own sessions are named for that agent rather than the generic
       * fallback both call sites otherwise use.
       */
      const scopeName = selectedProject?.name
        ?? (reportScope != null ? agentBadgeLabel(reportScope.agent, reportScope.profile) : undefined);
      const result = await exportSessions(selectedSessions, scopeName ?? '', Date.now());

      if (result.markdown.length > 0) {
        saveTextFile(`${scopeName ?? 'sessions'}.md`, result.markdown, 'text/markdown');
      }

      if (result.failed > 0) {
        pushToast(t('bulkExportFailed'), 'error');
      }
      setBulkBusy(false);
    })();
  };

  const projectCount = useMemo(() => {
    return new Set(projects.map((project) => {
      return project.actualPath ?? `name:${project.name}`;
    })).size;
  }, [projects]);

  const allSelectableSelected = selectableSessions.length > 0
    && selectableSessions.every((session) => {
      return selectedSessionPaths.includes(session.filePath);
    });

  // "All Projects" plus one report agent scopes the session list the same way
  // a single project does; only picking neither leaves it unscoped.
  const sessionsScoped = selectedProject != null || reportScope != null;

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
      ...showAllProjects
        ? [{
            id: 'all-projects',
            label: t('allProjects'),
            mark: <Layers className="size-3.5" />,
            selected: wholeMachine,
            onSelect: () => {
              exitSelectionMode();
              onSelectAllProjects();
            },
          }]
        : [],
      ...buildProjectTree(projects, {
        agentFilter: activeAgents,
        textFilter: projectFilter,
        dateFilter: projectDateFilter,
        order: projectOrder,
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

  // An icon like the fold toggle beside it, not a word: the header has room
  // for one control, and the tooltip carries the name.
  let sessionHeaderAction: ReactNode;

  if (selectionMode) {
    sessionHeaderAction = (
      <Tooltip content={t('cancelSelection')}>
        <button
          type="button"
          aria-label={t('cancelSelection')}
          onClick={exitSelectionMode}
          className="sidebar-header-icon"
        >
          <X className="size-3.5" />
        </button>
      </Tooltip>
    );
  }
  else if (selectableSessions.length > 0) {
    sessionHeaderAction = (
      <Tooltip content={t('selectSessions')}>
        <button
          type="button"
          aria-label={t('selectSessions')}
          onClick={() => {
            setMenuTarget(null);
            setSelectionMode(true);
          }}
          className="sidebar-header-icon"
        >
          <ListChecks className="size-3.5" />
        </button>
      </Tooltip>
    );
  }

  const rowClassName = (row: SessionRow, isContinuation: boolean): string => {
    const active = row.session.filePath === selectedFilePath;
    const selectedForDelete = selectedSessionPaths.includes(row.session.filePath);

    return cn('sidebar-row', isContinuation && 'ps-4', (selectedForDelete
      || (!selectionMode && active)) && 'is-active');
  };

  /**
   * One row's inner content, shared by a thread's head and each of its parts
   * so a card can group them without duplicating the row markup. Excludes
   * the `<li>` itself: a plain row supplies it directly, an animated part
   * supplies it through `motion.li` instead.
   */
  const renderRowContent = (row: SessionRow): ReactNode => {
    const session = row.session;
    const active = session.filePath === selectedFilePath;
    const canDelete = agentOption(session.agent).canDelete;
    const selectedForDelete = selectedSessionPaths.includes(session.filePath);
    const title = titleOf(session);
    const preview = previewOf(session);
    const threaded = row.partCount > 1;
    const open = expandedThreads.includes(row.threadKey);
    return (
      <>
        <LeadMark
          agent={session.agent}
          selecting={selectionMode}
          checked={selectedForDelete}
          reduceMotion={reduceMotion}
        />
        {/*
          Reserved on every row, threaded or not: a chevron that only exists
          some of the time shifts the title only some of the time, and a row
          with no thread reads as broken rather than as carrying one fewer
          control. Same size as .sidebar-thread-toggle, empty when unused.
        */}
        <div className="flex size-4 shrink-0 items-center justify-center">
          {threaded && (
            <Tooltip content={t('threadParts', { count: row.partCount })}>
              <button
                type="button"
                aria-expanded={open}
                aria-label={t('threadParts', { count: row.partCount })}
                data-thread-toggle={row.threadKey}
                onClick={() => {
                  toggleThread(row.threadKey);
                }}
                className="sidebar-thread-toggle"
              >
                <ChevronDown className="size-3" />
              </button>
            </Tooltip>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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
            className="flex min-w-0 flex-col gap-0.5 text-start"
          >
            <span className="flex w-full items-baseline gap-2">
              <span className="
                min-w-0 flex-1 truncate text-sm font-medium text-foreground
              "
              >
                {title}
              </span>
              <span className="shrink-0 font-mono text-figure text-faint">
                {formatTimeAgo(
                  session.lastTimestampMs,
                  nowMs,
                  i18n.language,
                )}
              </span>
            </span>
            {preview != null && (
              <span className="w-full truncate text-body text-muted-foreground">
                {preview}
              </span>
            )}
          </button>
          <span className="flex min-w-0 items-center gap-1">
            {reportScope != null && (
              <span className="
                min-w-0 truncate rounded-xs border border-border px-1 font-mono
                text-figure text-faint
              "
              >
                {projectNames.get(`${row.session.agent}:${row.session.projectId}`)
                  ?? row.session.projectId}
              </span>
            )}
            <span className="
              shrink-0 rounded-xs border border-border px-1 font-mono
              text-figure text-faint
            "
            >
              {t('messageCount', { count: row.messageCount })}
            </span>
          </span>
        </div>
      </>
    );
  };

  // The whole `<li>`: nested in a thread's own `<ul>` or standing directly in
  // the session list, a row is styled the same either way.
  const renderSessionRow = (row: SessionRow, isContinuation: boolean, index = 0): ReactElement => {
    return (
      <motion.li
        key={row.session.filePath}
        className={rowClassName(row, isContinuation)}
        {...arriveInSequence(index)}
      >
        {renderRowContent(row)}
      </motion.li>
    );
  };

  /**
   * One card around a thread's fullest transcript and the parts revealed by
   * expanding it: a part reads as belonging to the thread, not as a row that
   * happens to sit under the one above it. The `<ul>` and its head row stay
   * mounted whether or not it is open, so the group animates into and out of
   * a stable parent instead of cutting between two shapes.
   *
   * One motion element gated by the open boolean, exactly Disclosure's own
   * shape, rather than one per part: AnimatePresence animating a list that
   * starts genuinely empty does not reliably play an enter transition the
   * first time it gains children, only on every diff after that.
   */
  const renderThreadGroup = (head: SessionRow, parts: readonly SessionRow[]): ReactElement => {
    const open = expandedThreads.includes(head.threadKey);

    return (
      <li key={head.threadKey} className={cn(open && 'sidebar-thread-group')}>
        <ul>
          {renderSessionRow(head, false)}
          <AnimatePresence initial={false}>
            {open && (
              <motion.li
                key="parts"
                initial={{
                  height: 0,
                  opacity: 0,
                }}
                animate={{
                  height: 'auto',
                  opacity: 1,
                }}
                exit={{
                  height: 0,
                  opacity: 0,
                }}
                transition={collapse}
                className="overflow-hidden"
              >
                <ul>
                  {parts.map((row) => {
                    return renderSessionRow(row, true);
                  })}
                </ul>
              </motion.li>
            )}
          </AnimatePresence>
        </ul>
      </li>
    );
  };

  return (
    <aside className="flex min-h-0 shrink-0 overflow-hidden" data-sidebar>
      {/*
        * A column is never swapped for its strip: the width springs between the
        * two on a spring that carries velocity through an interrupting click,
        * and the old content fades out as the new fades in, so folding reads as
        * the column handing its width back rather than two states cutting.
        */}
      <motion.section
        initial={false}
        animate={{ width: projectsOpen ? projectsWidth : COLLAPSED_WIDTH }}
        transition={foldTransition}
        className="
          relative flex min-h-0 shrink-0 flex-col overflow-hidden rounded-lg
          border border-border bg-sidebar
        "
      >
        <AnimatePresence initial={false} mode="popLayout">
          {projectsOpen
            ? (
                <motion.div
                  key="open"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fadeTransition}
                  className="flex min-h-0 min-w-0 flex-1 flex-col"
                  style={{ width: projectsWidth }}
                >
                  <SectionHeader
                    icon={<FolderClosed className="size-3.5" />}
                    label={t('projects')}
                    count={projectCount}
                    casing="plain"
                    action={(
                      <PanelToggle
                        label={t('hideProjects')}
                        onToggle={() => {
                          setProjectsOpen(false);
                        }}
                      />
                    )}
                  />
                  <div className="flex shrink-0 items-center gap-1.5 px-3 pb-2">
                    <TextInput
                      value={projectFilter}
                      onInput={setProjectFilter}
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
                        onToggle: toggleProjectAgent,
                        onClear: () => {
                          setActiveAgents([]);
                        },
                      }}
                      dateFilter={projectDateFilter}
                      onDateFilterChange={setProjectDateFilter}
                      order={projectOrder}
                      onOrderChange={setProjectOrder}
                    />
                  </div>
                  {/* Pinned above the scroller: a scope control that scrolls
                      away with the list it scopes has become a list item. */}
                  {showAllProjects && (
                    <AllProjectsCard
                      projects={projects}
                      selected={wholeMachine}
                      onSelect={() => {
                        exitSelectionMode();
                        onSelectAllProjects();
                      }}
                      selectedScope={reportScope}
                      onSelectAgent={onSelectReportAgent}
                    />
                  )}
                  <ProjectTree
                    projects={projects}
                    projectsStatus={projectsStatus}
                    agentFilter={activeAgents}
                    textFilter={projectFilter}
                    dateFilter={projectDateFilter}
                    order={projectOrder}
                    selectedProject={selectedProject}
                    nowMs={nowMs}
                    showAgentChips={showAgentChips}
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
                </motion.div>
              )
            : (
                <motion.div
                  key="strip"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fadeTransition}
                  className="flex min-h-0 flex-1"
                >
                  <CollapsedStrip
                    expandLabel={t('showProjects')}
                    listLabel={t('projects')}
                    items={projectStripItems()}
                    onExpand={() => {
                      setProjectsOpen(true);
                    }}
                  />
                </motion.div>
              )}
        </AnimatePresence>
      </motion.section>
      {/* Folded, the strip has no width to resize, but the 8px still has to be
          here or its card border lands flush against the next one's. */}
      {projectsOpen
        ? (
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
          )
        : <div className="w-2 shrink-0" />}
      {/* The session list rides with the Sessions view alone: Health and
            Archive read the projects column, and a list of sessions under a
            report it cannot open is one more thing to look past. */}
      <AnimatePresence initial={false}>
        {showSessions && (
          <motion.section
            key="sessions-column"
            initial={false}
            animate={{ width: sessionsOpen ? sessionsWidth : COLLAPSED_WIDTH }}
            exit={{
              width: 0,
              opacity: 0,
            }}
            transition={foldTransition}
            className="
              relative flex min-h-0 shrink-0 flex-col overflow-hidden rounded-lg
              border border-border bg-background
            "
          >
            <AnimatePresence initial={false} mode="popLayout">
              {sessionsOpen
                ? (
                    <motion.div
                      key="open"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={fadeTransition}
                      className="flex min-h-0 min-w-0 flex-1 flex-col"
                      style={{ width: sessionsWidth }}
                    >
                      <SectionHeader
                        icon={<MessagesSquare className="size-3.5" />}
                        label={t('sessions')}
                        count={sessions.length > 0 ? sessions.length : undefined}
                        casing="plain"
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
                      {/* Slides open under the header rather than popping the
                          filter row down by its own height. */}
                      <AnimatePresence initial={false}>
                        {selectionMode && (
                          <motion.div
                            key="selection-bar"
                            initial={{
                              height: 0,
                              opacity: 0,
                            }}
                            animate={{
                              height: 'auto',
                              opacity: 1,
                            }}
                            exit={{
                              height: 0,
                              opacity: 0,
                            }}
                            transition={collapse}
                            className="shrink-0 overflow-hidden"
                          >
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
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="
                        flex shrink-0 items-center gap-1.5 px-3 pb-2
                      "
                      >
                        <TextInput
                          value={sessionFilter}
                          onInput={setSessionFilter}
                          label={t('filterSessions')}
                          placeholder={t('filterSessions')}
                          disabled={!sessionsScoped}
                          className="min-w-0 flex-1"
                        />
                        <FunnelMenu
                          label={t('filterAndSortSessions')}
                          dateFilter={sessionDateFilter}
                          onDateFilterChange={setSessionDateFilter}
                          order={sessionOrder}
                          onOrderChange={setSessionOrder}
                        />
                      </div>
                      <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
                        {sessionGroups.map((group) => {
                          const shut = collapsedGroups.includes(group.bucket);

                          return (
                            <Fragment key={group.bucket}>
                              <li>
                                <button
                                  type="button"
                                  aria-expanded={!shut}
                                  data-session-group={group.bucket}
                                  onClick={() => {
                                    toggleGroup(group.bucket);
                                  }}
                                  className="
                                    flex w-full items-center gap-1.5 px-2 pt-3
                                    pb-1 text-body font-semibold
                                    text-muted-foreground
                                    hover:text-foreground
                                  "
                                >
                                  <ChevronDown className={cn(`
                                    size-3 transition-transform
                                  `, shut && '-rotate-90')}
                                  />
                                  {t(BUCKET_LABEL[group.bucket])}
                                  <span className="
                                    ms-auto font-mono text-figure text-faint
                                  "
                                  >
                                    {group.count}
                                  </span>
                                </button>
                              </li>
                              {/* The group opens and shuts on the same disclosure
                                  motion as a thread, rather than cutting. */}
                              <AnimatePresence initial={false}>
                                {!shut && (
                                  <motion.li
                                    key="rows"
                                    initial={{
                                      height: 0,
                                      opacity: 0,
                                    }}
                                    animate={{
                                      height: 'auto',
                                      opacity: 1,
                                    }}
                                    exit={{
                                      height: 0,
                                      opacity: 0,
                                    }}
                                    transition={collapse}
                                    className="overflow-hidden"
                                  >
                                    <ul>
                                      {groupThreadRuns(group.rows).map(({ head, parts }, index) => {
                                        /**
                                         * partCount, not parts.length: a collapsed thread has
                                         * no parts to render yet but still needs the stable,
                                         * animatable wrapper so expanding it can transition in.
                                         */
                                        return head.partCount > 1
                                          ? renderThreadGroup(head, parts)
                                          : renderSessionRow(head, false, index);
                                      })}
                                    </ul>
                                  </motion.li>
                                )}
                              </AnimatePresence>
                            </Fragment>
                          );
                        })}
                        {sessionsStatus === 'loading' && (
                          <li className="flex justify-center py-4">
                            <Spinner />
                          </li>
                        )}
                        {sessionsStatus === 'ready' && !sessionsScoped && (
                          <EmptyState
                            icon={<FolderClosed className="size-8" />}
                            title={t('selectProject')}
                            hint={t('selectProjectHint')}
                          />
                        )}
                        {sessionsStatus === 'ready' && sessionsScoped && sessions.length === 0
                          && sessionFilter.trim().length === 0 && (
                          <EmptyState
                            icon={<MessagesSquare className="size-8" />}
                            title={t('noSessionsYet')}
                            hint={t('noStoredSessions')}
                          />
                        )}
                        {sessionsStatus === 'ready' && sessionsScoped && visibleSessions.length === 0
                          && (sessions.length > 0 || sessionFilter.trim().length > 0) && (
                          <EmptyState
                            icon={<Search className="size-8" />}
                            title={t('noSessionsMatch')}
                            hint={t('adjustFilter')}
                          />
                        )}
                      </ul>
                    </motion.div>
                  )
                : (
                    <motion.div
                      key="strip"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={fadeTransition}
                      className="flex min-h-0 flex-1"
                    >
                      <CollapsedStrip
                        expandLabel={t('showSessions')}
                        listLabel={t('sessions')}
                        items={sessionStripItems()}
                        onExpand={() => {
                          setSessionsOpen(true);
                        }}
                      />
                    </motion.div>
                  )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
      {showSessions && (sessionsOpen
        ? (
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
          )
        : <div className="w-2 shrink-0" />)}
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
