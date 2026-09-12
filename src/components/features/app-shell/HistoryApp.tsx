import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { initI18n } from '@i18n/index';
import { motion, MotionConfig } from 'motion/react';

import { appShortcuts } from '@config/shortcuts';

import {
  createArchive,
  deleteProject,
  deleteSession,
  renameSession,
  runRetention,
} from '@lib/apis/apiClient';
import { findAgentProject } from '@services/history/historyService';
import { isTypingTarget, matchesShortcut } from '@utils/shortcutUtils';

import {
  fadeTransition,
  ToastProvider,
  useToast,
} from '@ui/index';
import { AgentSetupPanel, usePluginToggle } from '@features/agent-setup';
import { AnalyticsView, useAnalyticsScope } from '@features/analytics';
import { AppHeader, CommandBar } from '@features/app-header';
import { ArchiveView } from '@features/archive';
import {
  useAgentSessions,
  useAgentSetup,
  useArchives,
  useProjects,
  useProjectStats,
  useRecentEdits,
  useRetention,
  useSearch,
  useSessions,
  useSettings,
  useStorage,
} from '@features/history-data';
import { SearchDialog } from '@features/search';
import {
  CopyTranscriptButton,
  editsInSession,
  ExportMenu,
  SessionViewer,
} from '@features/session-viewer';
import { SettingsSheet } from '@features/settings';
import { SidebarPane } from '@features/sidebar';
import { useTheme } from '@features/theme';
import { UpdateBanner } from '@features/updates';

import { ShortcutsDialog } from './partials';
import { NavRail } from './partials/NavRail';

import type { AgentId } from '@config/agents';
import type { ShortcutSpec } from '@config/shortcuts';
import type { AppView } from '@features/app-header';
import type { ArchivedSession } from '@services/archive/archiveService';
import type { FileEdit } from '@services/edits/editsService';
import type {
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
} from '@services/history/historyService';
import type { SearchHit } from '@services/search/searchService';
import type { SessionTokenTotals } from '@services/stats/statsService';
import type { FC, ReactNode } from 'react';

const EMPTY_PROJECTS: readonly ProjectSummary[] = [];

initI18n();

const HistoryAppView: FC = () => {
  const { t } = useTranslation('sidebar');
  const { t: tArchive } = useTranslation('archive');
  const projects = useProjects();
  const visibleProjects = projects.data ?? EMPTY_PROJECTS;
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  // The one agent a global report is scoped to, distinct from the Funnel's
  // multi-select Projects-tree filter.
  const [reportAgent, setReportAgent] = useState<AgentId | null>(null);
  const [view, setView] = useState<AppView>('analytics');
  const projectKey = selectedProject == null
    ? ''
    : `${selectedProject.agent}:${selectedProject.id}`;
  const { scope: analyticsScope, setScope: setAnalyticsScope } = useAnalyticsScope(projectKey);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { push: pushToast } = useToast();
  const [highlightTimestamp, setHighlightTimestamp] = useState<string | undefined>(undefined);
  const [archivedSession, setArchivedSession] = useState<ArchivedSession | null>(null);
  // The transcript the viewer has loaded, lifted here so the command bar's
  // export menu can sit beside Archive rather than inside the viewer's header.
  const [openEntries, setOpenEntries] = useState<readonly HistoryEntry[]>([]);
  const [nowMs] = useState(() => {
    return Date.now();
  });
  const projectSessions = useSessions(selectedProject, view === 'sessions');
  const agentSessions = useAgentSessions(reportAgent, visibleProjects, view === 'sessions');
  const sessions = reportAgent != null ? agentSessions : projectSessions;
  const stats = useProjectStats(view === 'analytics' ? selectedProject : null);
  const projectPath = selectedProject?.actualPath ?? '';
  const agentSetup = useAgentSetup(view === 'health' ? projectPath : '');
  const togglePlugin = usePluginToggle(projectPath, agentSetup.reload);
  const archives = useArchives(view === 'archive');
  const retention = useRetention(view === 'archive');
  const storage = useStorage(view === 'analytics');
  const [settingsAgent, setSettingsAgent] = useState<AgentId>('claude');
  const settings = useSettings(settingsOpen ? projectPath : null, settingsAgent);
  // The transcript's edits panel reads this list, narrowed to the open session.
  const edits = useRecentEdits(selectedProject, view === 'sessions');
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
  const sessionList = sessions.data ?? [];
  const theme = useTheme();
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
          pushToast(tArchive('retentionArchived', { count: result.archived }));
        }
      }
      catch {
        // Retention is a background courtesy; the Archive view reports failures properly.
      }
    })();

    return () => {
      mounted.current = false;
    };
  }, [pushToast, tArchive]);

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
      }],
      [appShortcuts.viewHealth, () => {
        setView('health');
      }],
      [appShortcuts.viewArchive, () => {
        setView('archive');
      }],
      [appShortcuts.viewSettings, () => {
        setSettingsOpen(true);
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
    setReportAgent(null);
  }, []);

  /**
   * The sidebar's "All Projects" card is a sibling of the project list, so
   * picking it has to clear the previous pick the same way selectProject does,
   * not just flip the Analytics scope and leave the old project marked selected.
   */
  const selectAllProjects = useCallback(() => {
    setSelectedProject(null);
    setSelectedFilePath(null);
    setHighlightTimestamp(undefined);
    setArchivedSession(null);
    setReportAgent(null);
    setAnalyticsScope('global');
  }, [setAnalyticsScope]);

  /**
   * Toggling twice, or reaching for "All Projects" itself, clears back to the
   * unfiltered global report. Picking an agent always means the whole machine:
   * there is no per-project, per-agent report to ask for.
   */
  const selectReportAgent = useCallback((agent: AgentId) => {
    setAnalyticsScope('global');
    setReportAgent((current) => {
      return current === agent ? null : agent;
    });
  }, [setAnalyticsScope]);

  // Every way of opening a transcript lands on the Sessions view.
  const showSession = useCallback(() => {
    setView('sessions');
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

  // Archives the open transcript on its own, the same copy-only operation the
  // sidebar's bulk select makes, so it survives the agent's next cleanup.
  const archiveOpenSession = useCallback(async () => {
    /* v8 ignore next 3 -- the command bar only wires this in with a session open */
    if (selectedSession?.actualSessionId == null) {
      return;
    }

    await createArchive({
      sessionKeys: [`${selectedSession.agent}:${selectedSession.actualSessionId}`],
    });
    pushToast(t('sessionArchived', { ns: 'common' }));
  }, [pushToast, selectedSession, t]);

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

  const openEditedSession = useCallback((edit: FileEdit) => {
    setSelectedFilePath(edit.sessionFilePath);
    setArchivedSession(null);
    setHighlightTimestamp(new Date(edit.timestampMs).toISOString());
    showSession();
  }, [showSession]);

  const openStatsSession = useCallback(
    (session: SessionTokenTotals) => {
      showSession();
      // A top session can come from a per-agent global rollup, so it is not
      // necessarily under the project already selected.
      setSelectedProject(findAgentProject(projects.data, session.projectId, session.agent));
      setSelectedFilePath(session.filePath);
      setHighlightTimestamp(new Date(session.lastTimestampMs).toISOString());
    },
    [projects.data, showSession],
  );

  const openAgent = archivedSession?.agent
    ?? selectedSession?.agent
    ?? selectedProject?.agent
    ?? 'claude';
  const openTitle = archivedSession?.title
    ?? selectedSession?.title
    ?? selectedSession?.summary
    ?? selectedSession?.preview;
  const openProject = archivedSession?.projectName ?? selectedProject?.name ?? '';
  const transcriptTitle = openTitle
    ?? selectedFilePath?.split('/').at(-1)
    ?? t('session', { ns: 'common' });
  const transcriptOpen = view === 'sessions' && openEntries.length > 0;

  const VIEWS: Record<AppView, ReactNode> = {
    sessions: (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SessionViewer
          filePath={selectedFilePath}
          agent={openAgent}
          sessionTitle={openTitle}
          gitBranch={selectedSession?.gitBranch}
          highlightTimestamp={highlightTimestamp}
          sourceModifiedMs={selectedSession?.modifiedMs ?? 0}
          editedFiles={editsInSession(edits.data ?? [], selectedFilePath ?? undefined)}
          editsStatus={edits.status}
          editsError={edits.error}
          projectPath={selectedProject?.actualPath}
          nowMs={nowMs}
          onOpenEdit={openEditedSession}
          onEntriesLoaded={setOpenEntries}
        />
      </div>
    ),
    analytics: (
      <AnalyticsView
        stats={stats.data}
        storage={storage}
        status={stats.status}
        projectName={selectedProject?.name ?? t('noProject')}
        scope={analyticsScope}
        projectAgent={selectedProject?.agent}
        sessions={sessionList}
        reportAgent={reportAgent}
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
          onPluginToggle={togglePlugin}
        />
      </div>
    ),
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="
        flex h-dvh flex-col overflow-hidden bg-recess text-foreground
      "
      >
        <UpdateBanner />
        {/* Titlebar and command bar run the full width, above the rail: the
            chrome frames the window, the rail is a control inside it. */}
        <AppHeader
          onOpenSearch={() => {
            setSearchOpen(true);
          }}
          onOpenSettings={() => {
            setSettingsOpen(true);
          }}
          onReload={projects.reload}
        />
        <CommandBar
          view={view}
          projectName={selectedProject?.name ?? null}
          scope={analyticsScope}
          onScopeChange={setAnalyticsScope}
          onArchiveSession={view === 'sessions' && selectedSession?.actualSessionId != null
            ? archiveOpenSession
            : null}
          onNotice={(message) => {
            pushToast(message, 'error');
          }}
          actions={transcriptOpen
            ? (
                <CopyTranscriptButton
                  key={selectedFilePath ?? ''}
                  entries={openEntries}
                  project={openProject}
                  title={transcriptTitle}
                />
              )
            : null}
          overflow={transcriptOpen
            ? (
                <ExportMenu
                  entries={openEntries}
                  project={openProject}
                  title={transcriptTitle}
                />
              )
            : null}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/*
            * The rail sits at the window edge, ahead of the columns, so where
            * you are never scrolls away with what you are looking at.
            */}
          <NavRail
            flagged={(agentSetup.data?.findings ?? []).length}
            view={view}
            onViewChange={setView}
          />
          {/*
            * The columns are cards on a darker canvas, and the sidebar sizes
            * itself from the ones it holds open, so folding one gives the width
            * back to the pane rather than to the other column. The 8px gaps
            * between them are the resize dividers, which is why there is no gap
            * class here.
            */}
          <div className="flex min-h-0 min-w-0 flex-1 p-2">
            <SidebarPane
              wholeMachine={analyticsScope === 'global'}
              onSelectAllProjects={selectAllProjects}
              reportAgent={reportAgent}
              onSelectReportAgent={selectReportAgent}
              showSessions={view === 'sessions'}
              showAllProjects={view === 'sessions' || view === 'analytics'}
              projects={visibleProjects}
              projectsStatus={projects.status}
              projectNames={projectNames}
              selectedProject={selectedProject}
              sessions={sessionList}
              sessionsStatus={sessions.status}
              selectedFilePath={selectedFilePath}
              nowMs={nowMs}
              onSelectProject={selectProject}
              onSelectSession={selectSession}
              onDeleteProject={deleteSelectedProject}
              onRenameSession={renameSelectedSession}
              onDeleteSession={deleteSelectedSession}
            />
            <motion.div
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={fadeTransition}
              className="
                flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg
                border border-border bg-background
              "
            >
              {VIEWS[view]}
            </motion.div>
          </div>
        </div>

        <ShortcutsDialog
          open={shortcutsOpen}
          onClose={() => {
            setShortcutsOpen(false);
          }}
        />

        <SettingsSheet
          agent={settingsAgent}
          open={settingsOpen}
          projectPath={selectedProject?.actualPath ?? null}
          settings={settings}
          themeMode={theme.mode}
          onClose={() => {
            setSettingsOpen(false);
          }}
          onSelectAgent={setSettingsAgent}
          onThemeChange={theme.setMode}
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

// The one Toast stack the whole app shares lives above everything that can
// report through it, so two unrelated notices never land on top of each other.
export const HistoryApp: FC = () => {
  return (
    <ToastProvider>
      <HistoryAppView />
    </ToastProvider>
  );
};
