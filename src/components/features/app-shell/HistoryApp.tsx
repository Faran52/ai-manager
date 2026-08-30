import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { initI18n } from '@i18n/index';
import { Settings } from 'lucide-react';
import { motion, MotionConfig } from 'motion/react';

import { appShortcuts } from '@config/shortcuts';
import { sidebarWidthStorageKey } from '@config/storageKeys';

import {
  deleteProject,
  deleteSession,
  renameSession,
  runRetention,
} from '@lib/apis/apiClient';
import { findAgentProject } from '@services/history/historyService';
import { cn } from '@utils/cnUtils';
import { isTypingTarget, matchesShortcut } from '@utils/shortcutUtils';

import {
  Button,
  fadeTransition,
  PaneDivider,
  Toast,
} from '@ui/index';
import { AgentSetupPanel } from '@features/agent-setup';
import { AnalyticsView, useAnalyticsScope } from '@features/analytics';
import { AppHeader } from '@features/app-header';
import { ArchiveView } from '@features/archive';
import {
  useAgentSetup,
  useArchives,
  useNewestSessions,
  useProjects,
  useProjectStats,
  usePrompts,
  useRecentEdits,
  useRetention,
  useSearch,
  useSessions,
  useSettings,
  useStorage,
} from '@features/history-data';
import { PromptHistoryPanel } from '@features/prompts';
import { SearchDialog } from '@features/search';
import { SessionViewer } from '@features/session-viewer';
import { SettingsView } from '@features/settings';
import { SidebarPane } from '@features/sidebar';
import { useTheme } from '@features/theme';
import { UpdateBanner } from '@features/updates';

import { ShortcutsDialog } from './partials';

import type { AgentId } from '@config/agents';
import type { ShortcutSpec } from '@config/shortcuts';
import type { AnalyticsPanelName } from '@features/analytics';
import type { AppView } from '@features/app-header';
import type { ArchivedSession } from '@services/archive/archiveService';
import type { FileEdit } from '@services/edits/editsService';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { SearchHit } from '@services/search/searchService';
import type { SessionTokenTotals } from '@services/stats/statsService';
import type { FC, ReactNode } from 'react';

type SessionsPanel = 'sessions' | 'prompts';

const EMPTY_PROJECTS: readonly ProjectSummary[] = [];
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 520;
const DEFAULT_SIDEBAR_WIDTH = 340;

const initialSidebarWidth = (): number => {
  const stored = Number(localStorage.getItem(sidebarWidthStorageKey));

  return Number.isFinite(stored) && stored >= MIN_SIDEBAR_WIDTH
    ? Math.min(stored, MAX_SIDEBAR_WIDTH)
    : DEFAULT_SIDEBAR_WIDTH;
};

initI18n();

const SESSION_PANELS: readonly SessionsPanel[] = ['sessions', 'prompts'];

export const HistoryApp: FC = () => {
  const { t } = useTranslation('sidebar');
  const { t: tArchive } = useTranslation('archive');
  const { t: tCommon } = useTranslation('common');
  const projects = useProjects();
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('analytics');
  const [sessionsPanel, setSessionsPanel] = useState<SessionsPanel>('sessions');
  const [analyticsPanel, setAnalyticsPanel] = useState<AnalyticsPanelName>('report');
  const projectKey = selectedProject == null
    ? ''
    : `${selectedProject.agent}:${selectedProject.id}`;
  const { scope: analyticsScope, setScope: setAnalyticsScope } = useAnalyticsScope(projectKey);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [retentionNotice, setRetentionNotice] = useState<string | null>(null);
  const [highlightTimestamp, setHighlightTimestamp] = useState<string | undefined>(undefined);
  const [archivedSession, setArchivedSession] = useState<ArchivedSession | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  const [nowMs] = useState(() => {
    return Date.now();
  });
  const sessions = useSessions(selectedProject, view === 'sessions' && selectedFilePath != null);
  const stats = useProjectStats(view === 'analytics' ? selectedProject : null);
  const agentSetup = useAgentSetup(view === 'health' ? (selectedProject?.actualPath ?? null) : null);
  const archives = useArchives(view === 'archive');
  const prompts = usePrompts(view === 'sessions' && sessionsPanel === 'prompts');
  const retention = useRetention(view === 'archive');
  const storage = useStorage(view === 'analytics');
  const settings = useSettings(view === 'settings' ? (selectedProject?.actualPath ?? '') : null);
  const boardScope = view === 'analytics' && analyticsPanel !== 'report';
  const edits = useRecentEdits(analyticsScope === 'project' ? selectedProject : null, boardScope);
  const newestSessions = useNewestSessions(boardScope && analyticsScope === 'global');
  const sessionCounts = useMemo(() => {
    const path = selectedProject?.actualPath;

    return (projects.data ?? []).reduce<Partial<Record<AgentId, number>>>((totals, project) => {
      return project.actualPath != null && project.actualPath === path
        ? {
            ...totals,
            [project.agent]: (totals[project.agent] ?? 0) + project.sessionCount,
          }
        : totals;
    }, {});
  }, [projects.data, selectedProject]);
  const search = useSearch();
  const theme = useTheme();
  const visibleProjects = projects.data ?? EMPTY_PROJECTS;
  const reloadProjects = projects.reload;

  const selectedSession = useMemo(
    () => {
      return sessions.data?.find((session) => {
        return session.filePath === selectedFilePath;
      }) ?? null;
    },
    [sessions.data, selectedFilePath],
  );
  const projectNames = useMemo(
    () => {
      return new Map<string, string>(visibleProjects.map((project) => {
        return [`${project.agent}:${project.id}`, project.name];
      }));
    },
    [visibleProjects],
  );

  useEffect(() => {
    localStorage.setItem(sidebarWidthStorageKey, String(sidebarWidth));
  }, [sidebarWidth]);

  /**
   * The agents prune on their own schedule and this app is only running some of
   * the time, so the one moment it can get ahead of them is launch. Safe to do
   * unasked because retention copies and never deletes; a failure stays silent
   * rather than greeting someone with an error they did not ask for.
   */
  useEffect(() => {
    // A plain `let` reads as always-true to the compiler inside this closure, so
    // the flag lives on an object the cleanup can flip where it can be seen.
    const mounted = { current: true };

    void (async (): Promise<void> => {
      try {
        const { result } = await runRetention();

        if (mounted.current && result.archived > 0) {
          setRetentionNotice(tArchive('retentionArchived', { count: result.archived }));
        }
      }
      catch {
        // Retention is a background courtesy; the Archive view reports failures properly.
      }
    })();

    return () => {
      mounted.current = false;
    };
  }, [tArchive]);

  // One listener for every global binding, so a shortcut is added by adding a
  // row here and to `appShortcuts` rather than by growing another effect.
  useEffect(() => {
    const actions: readonly (readonly [ShortcutSpec, () => void])[] = [
      [appShortcuts.openSearch, () => {
        setSearchOpen(true);
      }],
      [appShortcuts.showShortcuts, () => {
        setShortcutsOpen(true);
      }],
      [appShortcuts.viewSessions, () => {
        setView('sessions');
      }],
      [appShortcuts.viewAnalytics, () => {
        setView('analytics');
        setAnalyticsPanel('report');
      }],
      [appShortcuts.viewHealth, () => {
        setView('health');
      }],
      [appShortcuts.viewArchive, () => {
        setView('archive');
      }],
      [appShortcuts.viewSettings, () => {
        setView('settings');
      }],
      [appShortcuts.viewBoard, () => {
        setView('analytics');
        setAnalyticsPanel('sessions');
      }],
      [appShortcuts.reload, reloadProjects],
    ];

    const onKey = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) {
        return;
      }

      for (const [spec, run] of actions) {
        if (matchesShortcut(event, spec)) {
          event.preventDefault();
          run();

          return;
        }
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [reloadProjects]);

  const selectProject = useCallback((project: ProjectSummary) => {
    setSelectedProject(project);
    setSelectedFilePath(null);
    setHighlightTimestamp(undefined);
    setArchivedSession(null);
  }, []);

  /*
   * Every way of opening a transcript lands in the same place, so asking for
   * one from the prompt list does not leave the list still covering it.
   */
  const showSession = useCallback(() => {
    setView('sessions');
    setSessionsPanel('sessions');
  }, []);

  const selectSession = useCallback((session: SessionSummary) => {
    setSelectedProject(findAgentProject(projects.data, session.projectId, session.agent));
    setSelectedFilePath(session.filePath);
    setHighlightTimestamp(undefined);
    setArchivedSession(null);
    showSession();
  }, [projects.data, showSession]);

  const deleteSelectedProject = useCallback(async (project: ProjectSummary) => {
    const wasSelected = selectedProject?.id === project.id && selectedProject.agent === project.agent;

    await deleteProject({
      agent: project.agent,
      projectId: project.id,
    });

    if (wasSelected) {
      setSelectedProject(null);
      setSelectedFilePath(null);
    }

    projects.reload();
  }, [projects, selectedProject]);

  const renameSelectedSession = useCallback(async (session: SessionSummary, title: string) => {
    await renameSession({
      agent: session.agent,
      filePath: session.filePath,
      actualSessionId: session.actualSessionId,
      title,
    });
    sessions.reload();
  }, [sessions]);

  const deleteSelectedSession = useCallback(async (session: SessionSummary) => {
    await deleteSession({
      agent: session.agent,
      filePath: session.filePath,
      actualSessionId: session.actualSessionId,
    });

    if (selectedFilePath === session.filePath) {
      setSelectedFilePath(null);
    }

    sessions.reload();
    projects.reload();
  }, [projects, selectedFilePath, sessions]);

  const jumpToHit = useCallback(
    (hit: SearchHit) => {
      setView('sessions');
      setSelectedProject(findAgentProject(projects.data, hit.projectId, hit.agent));
      setSelectedFilePath(hit.filePath);
      setHighlightTimestamp(new Date(hit.timestampMs).toISOString());
    },
    [projects.data],
  );

  // An archived transcript has no live project behind it, so the viewer is
  // pointed straight at the backup copy and the sidebar selection is cleared.
  const openArchivedSession = useCallback((session: ArchivedSession) => {
    showSession();
    setSelectedProject(null);
    setArchivedSession(session);
    setSelectedFilePath(session.archivePath);
    setHighlightTimestamp(undefined);
  }, [showSession]);

  // The panel only offers a prompt whose transcript survives, so the path resolves.
  const openPromptSession = useCallback((filePath: string, timestampMs: number) => {
    showSession();
    setSelectedProject(null);
    setArchivedSession(null);
    setSelectedFilePath(filePath);
    setHighlightTimestamp(new Date(timestampMs).toISOString());
  }, [showSession]);

  const openEditedSession = useCallback((edit: FileEdit) => {
    setSelectedFilePath(edit.sessionFilePath);
    setArchivedSession(null);
    setHighlightTimestamp(new Date(edit.timestampMs).toISOString());
    showSession();
  }, [showSession]);

  const openStatsSession = useCallback(
    (session: SessionTokenTotals) => {
      showSession();
      setSelectedFilePath(session.filePath);
      setHighlightTimestamp(new Date(session.lastTimestampMs).toISOString());
    },
    [],
  );

  const VIEWS: Record<AppView, ReactNode> = {
    sessions: (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <nav
          className="
            flex shrink-0 items-center gap-1 border-b border-border px-3 py-2
          "
          aria-label={tCommon('sessionsPanels')}
        >
          {SESSION_PANELS.map((name) => {
            return (
              <Button
                key={name}
                size="sm"
                variant={name === sessionsPanel ? 'primary' : 'ghost'}
                pressed={name === sessionsPanel}
                onClick={() => {
                  setSessionsPanel(name);
                }}
              >
                {tCommon(name === 'sessions' ? 'navSessions' : 'navPrompts')}
              </Button>
            );
          })}
        </nav>

        {sessionsPanel === 'prompts'
          ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mx-auto max-w-4xl">
                  <PromptHistoryPanel
                    history={prompts}
                    nowMs={nowMs}
                    projectPath={selectedProject?.actualPath}
                    sessionId={selectedSession?.agent === 'claude'
                      ? selectedSession.actualSessionId
                      : undefined}
                    onOpenPrompt={openPromptSession}
                  />
                </div>
              </div>
            )
          : (
              <SessionViewer
                filePath={selectedFilePath}
                agent={archivedSession?.agent
                  ?? selectedSession?.agent
                  ?? selectedProject?.agent
                  ?? 'claude'}
                projectLabel={archivedSession?.projectName ?? selectedProject?.name ?? ''}
                sessionTitle={archivedSession?.title
                  ?? selectedSession?.title
                  ?? selectedSession?.summary
                  ?? selectedSession?.preview}
                gitBranch={selectedSession?.gitBranch}
                highlightTimestamp={highlightTimestamp}
                sourceModifiedMs={selectedSession?.modifiedMs ?? 0}
              />
            )}
      </div>
    ),
    analytics: (
      <AnalyticsView
        stats={stats.data}
        storage={storage}
        status={stats.status}
        projectName={selectedProject?.name ?? t('noProject')}
        scope={analyticsScope}
        onScopeChange={setAnalyticsScope}
        projectAgent={selectedProject?.agent}
        projectPath={selectedProject?.actualPath}
        sessions={analyticsScope === 'global' ? newestSessions.data ?? [] : sessions.data ?? []}
        sessionsStatus={analyticsScope === 'global' ? newestSessions.status : sessions.status}
        edits={edits}
        nowMs={nowMs}
        panel={analyticsPanel}
        onPanelChange={setAnalyticsPanel}
        onOpenBoardSession={selectSession}
        onOpenEdit={openEditedSession}
        onOpenSession={openStatsSession}
      />
    ),
    archive: (
      <ArchiveView
        archives={archives}
        retention={retention}
        nowMs={nowMs}
        onOpenSession={openArchivedSession}
      />
    ),
    settings: (
      <SettingsView settings={settings} projectPath={selectedProject?.actualPath ?? null} />
    ),
    health: (
      <div className="h-full overflow-y-auto p-4">
        <AgentSetupPanel
          projectSelected={selectedProject != null}
          projectPath={selectedProject?.actualPath ?? ''}
          setups={agentSetup.data?.setups ?? []}
          findings={agentSetup.data?.findings ?? []}
          usage={agentSetup.data?.usage ?? null}
          plugins={agentSetup.data?.plugins ?? []}
          trust={agentSetup.data?.trust ?? {
            known: false,
            trusted: false,
            onboarded: false,
          }}
          sessionCounts={sessionCounts}
          nowMs={nowMs}
        />
      </div>
    ),
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-dvh overflow-hidden bg-background text-foreground">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <UpdateBanner />
          <AppHeader
            view={view}
            onViewChange={setView}
            onOpenSearch={() => {
              setSearchOpen(true);
            }}
            onReload={projects.reload}
            themeMode={theme.mode}
            onThemeChange={theme.setMode}
          />

          <div
            className="grid min-h-0 flex-1 overflow-hidden"
            style={{ gridTemplateColumns: `${String(sidebarWidth)}px 8px minmax(0, 1fr)` }}
          >
            <SidebarPane
              projects={visibleProjects}
              projectsStatus={projects.status}
              selectedProject={selectedProject}
              sessions={sessions.data ?? []}
              sessionsStatus={sessions.status}
              selectedFilePath={selectedFilePath}
              nowMs={nowMs}
              onSelectProject={selectProject}
              onSelectSession={selectSession}
              onDeleteProject={deleteSelectedProject}
              onRenameSession={renameSelectedSession}
              onDeleteSession={deleteSelectedSession}
            />
            <PaneDivider
              label={t('resizeSidebar')}
              value={sidebarWidth}
              min={MIN_SIDEBAR_WIDTH}
              max={MAX_SIDEBAR_WIDTH}
              orientation="horizontal"
              onResize={(delta) => {
                setSidebarWidth((width) => {
                  return Math.min(Math.max(width + delta, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
                });
              }}
            />
            <motion.div
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={fadeTransition}
              className="flex min-h-0 min-w-0 flex-col overflow-hidden"
            >
              {VIEWS[view]}
            </motion.div>
          </div>
        </div>

        {/*
          * Settings are reached from a corner rather than from the row of
          * views: they are somewhere you go once to change something, not one
          * of the places you work.
          */}
        <button
          type="button"
          aria-label={tCommon('navSettings')}
          aria-pressed={view === 'settings'}
          title={tCommon('navSettings')}
          data-settings-button
          onClick={() => {
            setView(view === 'settings' ? 'sessions' : 'settings');
          }}
          className={cn(`
            fixed inset-e-4 bottom-4 z-20 flex size-9 items-center
            justify-center rounded-full border border-border bg-card
            text-muted-foreground shadow-lg transition-colors
            hover:text-foreground
          `, view === 'settings' && 'bg-primary text-primary-foreground')}
        >
          <Settings className="size-4" />
        </button>

        <Toast message={retentionNotice} />

        <ShortcutsDialog
          open={shortcutsOpen}
          onClose={() => {
            setShortcutsOpen(false);
          }}
        />

        <SearchDialog
          open={searchOpen}
          onClose={() => {
            setSearchOpen(false);
          }}
          search={search}
          projectNames={projectNames}
          onJump={jumpToHit}
        />
      </div>
    </MotionConfig>
  );
};
