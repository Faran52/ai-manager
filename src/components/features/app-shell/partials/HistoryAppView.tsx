import {
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { motion, MotionConfig } from 'motion/react';

import {
  createArchive,
  deleteProject,
  deleteSession,
  renameSession,
} from '@lib/apis/apiClient';

import { fadeTransition, useToast } from '@ui/index';
import {
  AgentInstallSection,
  AgentSetupPanel,
  setupKey,
  usePluginToggle,
} from '@features/agent-setup';
import { AnalyticsView, useAnalyticsScope } from '@features/analytics';
import { AppHeader } from '@features/app-header';
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

import { useAppShortcuts } from '../hooks/useAppShortcuts';
import { useRetentionOnLaunch } from '../hooks/useRetentionOnLaunch';
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection';

import { NavRail } from './NavRail';
import { ShortcutsDialog } from './ShortcutsDialog';

import type { AgentId } from '@config/agents';
import type { AppView } from '@features/app-header';
import type {
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
} from '@services/history/historyService';
import type { FC, ReactNode } from 'react';

const EMPTY_PROJECTS: readonly ProjectSummary[] = [];

// The whole window: titlebar, rail, the sidebar pane and the view beside it,
// plus the dialogs that float over all of them.
export const HistoryAppView: FC = () => {
  const { t } = useTranslation('sidebar');
  const { push: pushToast } = useToast();
  const projects = useProjects();
  const visibleProjects = projects.data ?? EMPTY_PROJECTS;
  const [view, setView] = useState<AppView>('analytics');
  // Every way of opening a transcript lands on the Sessions view.
  const showSession = useCallback(() => {
    setView('sessions');
  }, []);
  const [nowMs] = useState(() => {
    return Date.now();
  });
  const dialogs = useAppShortcuts(setView, projects.reload);

  useRetentionOnLaunch();

  const workspace = useWorkspaceSelection(projects.data, showSession);
  const {
    selectedProject,
    selectedFilePath,
    reportScope,
    highlightTimestamp,
    archivedSession,
  } = workspace;
  const projectKey = selectedProject == null ? '' : `${selectedProject.agent}:${selectedProject.id}`;
  const { scope: analyticsScope, setScope: setAnalyticsScope } = useAnalyticsScope(projectKey);

  // Widening to the whole machine, by either route, also resets the report scope.
  const selectAllProjects = useCallback(() => {
    workspace.selectAllProjects();
    setAnalyticsScope('global');
  }, [setAnalyticsScope, workspace]);

  const selectReportAgent = useCallback((agent: AgentId, profile?: string) => {
    workspace.selectReportAgent(agent, profile);
    setAnalyticsScope('global');
  }, [setAnalyticsScope, workspace]);

  // The transcript the viewer has loaded, lifted here so the titlebar's
  // export menu can sit beside Archive rather than inside the viewer's header.
  const [openEntries, setOpenEntries] = useState<readonly HistoryEntry[]>([]);
  const projectSessions = useSessions(selectedProject, view === 'sessions');
  const agentSessions = useAgentSessions(reportScope, visibleProjects, view === 'sessions');
  const sessions = reportScope != null ? agentSessions : projectSessions;
  const stats = useProjectStats(view === 'analytics' ? selectedProject : null);
  const projectPath = selectedProject?.actualPath ?? '';
  // Analytics shows the recorded usage this call carries, so both views read it.
  const agentSetup = useAgentSetup(view === 'health' || view === 'analytics' ? projectPath : '');
  const togglePlugin = usePluginToggle(projectPath, agentSetup.reload);
  const archives = useArchives(view === 'archive');
  const retention = useRetention(view === 'archive');
  const storage = useStorage(view === 'analytics');
  // The transcript's edits panel reads this list, narrowed to the open session.
  const edits = useRecentEdits(selectedProject, view === 'sessions');
  const search = useSearch();
  const theme = useTheme();
  const sessionList = sessions.data ?? [];

  const sessionCounts = useMemo(() => {
    const path = selectedProject?.actualPath;

    return (projects.data ?? []).reduce<Record<string, number>>((totals, project) => {
      const key = setupKey(project);

      return project.actualPath != null && project.actualPath === path
        ? {
            ...totals,
            [key]: (totals[key] ?? 0) + project.sessionCount,
          }
        : totals;
    }, {});
  }, [projects.data, selectedProject]);

  const selectedSession = useMemo(() => {
    return sessions.data?.find((session) => {
      return session.filePath === selectedFilePath;
    }) ?? null;
  }, [sessions.data, selectedFilePath]);

  const projectNames = useMemo(() => {
    return new Map<string, string>(visibleProjects.map((project) => {
      return [`${project.agent}:${project.id}`, project.name];
    }));
  }, [visibleProjects]);

  const deleteSelectedProject = useCallback(async (project: ProjectSummary) => {
    const wasSelected = selectedProject?.id === project.id && selectedProject.agent === project.agent;

    await deleteProject({
      agent: project.agent,
      projectId: project.id,
    });

    if (wasSelected) {
      workspace.setSelectedProject(null);
      workspace.setSelectedFilePath(null);
    }

    projects.reload();
  }, [projects, selectedProject, workspace]);

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
      workspace.setSelectedFilePath(null);
    }

    sessions.reload();
    projects.reload();
  }, [projects, selectedFilePath, sessions, workspace]);

  // Archives the open transcript on its own, the same copy-only operation the
  // sidebar's bulk select makes, so it survives the agent's next cleanup.
  const archiveOpenSession = useCallback(async () => {
    /* v8 ignore next 3 -- the titlebar only wires this in with a session open */
    if (selectedSession?.actualSessionId == null) {
      return;
    }

    await createArchive({
      sessionKeys: [`${selectedSession.agent}:${selectedSession.actualSessionId}`],
    });
    pushToast(t('sessionArchived', { ns: 'common' }));
  }, [pushToast, selectedSession, t]);

  const openAgent = archivedSession?.agent
    ?? selectedSession?.agent
    ?? selectedProject?.agent
    ?? 'claude';
  // The archive reads a separate ArchivedSession type with no profile of its own.
  const openProfile = selectedSession?.profile ?? selectedProject?.profile;
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
          profile={openProfile}
          sessionTitle={openTitle}
          gitBranch={selectedSession?.gitBranch}
          highlightTimestamp={highlightTimestamp}
          sourceModifiedMs={selectedSession?.modifiedMs ?? 0}
          editedFiles={editsInSession(edits.data ?? [], selectedFilePath ?? undefined)}
          editsStatus={edits.status}
          editsError={edits.error}
          projectPath={selectedProject?.actualPath}
          nowMs={nowMs}
          onOpenEdit={workspace.openEditedSession}
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
        reportScope={reportScope}
        usage={agentSetup.data?.usage ?? null}
        nowMs={nowMs}
        onOpenSession={workspace.openStatsSession}
      />
    ),
    archive: (
      <ArchiveView
        archives={archives}
        retention={retention}
        nowMs={nowMs}
        selectedProject={selectedProject}
        onShowAll={selectAllProjects}
        onOpenSession={workspace.openArchivedSession}
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
          trust={agentSetup.data?.trust ?? {
            known: false,
            trusted: false,
            onboarded: false,
          }}
          sessionCounts={sessionCounts}
          nowMs={nowMs}
          onPluginToggle={togglePlugin}
        />
        {/* A fact about this machine, not the project, so it reads last. */}
        <AgentInstallSection />
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
        {/* The titlebar runs the full width, above the rail: the chrome
            frames the window, the rail is a control inside it. */}
        <AppHeader
          view={view}
          onOpenSearch={() => {
            dialogs.setSearchOpen(true);
          }}
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
            onReload={projects.reload}
            onOpenSettings={() => {
              dialogs.setSettingsOpen(true);
            }}
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
              reportScope={reportScope}
              onSelectReportAgent={selectReportAgent}
              showSessions={view === 'sessions'}
              showAllProjects={view === 'sessions' || view === 'analytics'}
              showAgentChips={view !== 'health'}
              projects={visibleProjects}
              projectsStatus={projects.status}
              projectNames={projectNames}
              selectedProject={selectedProject}
              sessions={sessionList}
              sessionsStatus={sessions.status}
              selectedFilePath={selectedFilePath}
              nowMs={nowMs}
              onSelectProject={workspace.selectProject}
              onSelectSession={workspace.selectSession}
              onDeleteProject={deleteSelectedProject}
              onRenameSession={renameSelectedSession}
              onDeleteSession={deleteSelectedSession}
            />
            <motion.div
              key={view}
              initial={{
                opacity: 0,
                y: 6,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
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
          open={dialogs.shortcutsOpen}
          onClose={() => {
            dialogs.setShortcutsOpen(false);
          }}
        />

        <SettingsSheet
          open={dialogs.settingsOpen}
          themeMode={theme.mode}
          onClose={() => {
            dialogs.setSettingsOpen(false);
          }}
          onThemeChange={theme.setMode}
        />

        <SearchDialog
          open={dialogs.searchOpen}
          onClose={() => {
            dialogs.setSearchOpen(false);
          }}
          search={search}
          projectNames={projectNames}
          onJump={workspace.jumpToHit}
        />
      </div>
    </MotionConfig>
  );
};
