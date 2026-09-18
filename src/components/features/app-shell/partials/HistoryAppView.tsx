import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { motion, MotionConfig } from 'motion/react';

import {
  createArchive,
  deleteProject,
  deleteSession,
  renameSession,
} from '@lib/apis/apiClient';
import { projectKeyOf } from '@services/history/historyService';

import { fadeTransition, useToast } from '@ui/index';
import { useAnalyticsScope } from '@features/analytics';
import { AppHeader } from '@features/app-header';
import { useProjects } from '@features/history-data';
import { CopyTranscriptButton, ExportMenu } from '@features/session-viewer';
import { SidebarPane } from '@features/sidebar';
import { useTheme } from '@features/theme';
import {
  UpdateBanner,
  UpdateMark,
  useUpdateProbe,
} from '@features/updates';

import { useAppCommands } from '../hooks/useAppCommands';
import { useAppShortcuts } from '../hooks/useAppShortcuts';
import { useDesktop } from '../hooks/useDesktop';
import { useHistoryAppData } from '../hooks/useHistoryAppData';
import { useNativeMenu } from '../hooks/useNativeMenu';
import { useRetentionOnLaunch } from '../hooks/useRetentionOnLaunch';
import { useWorkspaceSelection } from '../hooks/useWorkspaceSelection';
import { openSessionFacts } from '../utils/openSessionUtils';

import { HistoryAppDialogs } from './HistoryAppDialogs';
import { HistoryAppPane } from './HistoryAppPane';
import { NavRail } from './NavRail';

import type { AgentId } from '@config/agents';
import type { AppView } from '@features/app-header';
import type {
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
} from '@services/history/historyService';
import type { FC } from 'react';

// The whole window: titlebar, rail, the sidebar pane and the view beside it,
// plus the dialogs that float over all of them.
export const HistoryAppView: FC = () => {
  const { t } = useTranslation('sidebar');
  const { push: pushToast } = useToast();
  const projects = useProjects();
  const [view, setView] = useState<AppView>('analytics');
  // Every way of opening a transcript lands on the Sessions view.
  const showSession = useCallback(() => {
    setView('sessions');
  }, []);
  const [nowMs] = useState(() => {
    return Date.now();
  });
  const dialogs = useAppShortcuts(setView, projects.reload);
  const updateProbe = useUpdateProbe();
  const { setSettingsOpen, setShortcutsOpen } = dialogs;

  const {
    runCommand,
    aboutOpen,
    closeAbout,
  } = useAppCommands({
    setView,
    reloadProjects: projects.reload,
    setSettingsOpen,
    setShortcutsOpen,
  });

  // True once the window is carrying the menu, which owns Settings there.
  const nativeMenu = useNativeMenu(runCommand);
  // Only an installed build can replace itself, so only it offers the check.
  const desktop = useDesktop();

  useRetentionOnLaunch();

  const workspace = useWorkspaceSelection(projects.data, showSession);
  const {
    selectedProject,
    selectedFilePath,
    reportScope,
    highlightTimestamp,
    archivedSession,
  } = workspace;
  const projectKey = selectedProject == null ? '' : projectKeyOf(selectedProject.agent, selectedProject.id);
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
  const theme = useTheme();
  const {
    visibleProjects,
    sessions,
    sessionList,
    selectedSession,
    projectNames,
    sessionCounts,
    stats,
    agentSetup,
    togglePlugin,
    archives,
    retention,
    storage,
    edits,
    search,
    findingCount,
  } = useHistoryAppData(view, projects, workspace);

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

  const open = openSessionFacts({
    archivedSession,
    selectedSession,
    selectedProject,
    selectedFilePath,
    fallbackTitle: t('session', { ns: 'common' }),
  });
  const transcriptOpen = view === 'sessions' && openEntries.length > 0;
  const archivable = view === 'sessions' && selectedSession?.actualSessionId != null;
  const transcriptActions = transcriptOpen
    ? (
        <CopyTranscriptButton
          key={selectedFilePath ?? ''}
          entries={openEntries}
          project={open.project}
          title={open.transcriptTitle}
        />
      )
    : null;
  const transcriptOverflow = transcriptOpen
    ? (
        <ExportMenu
          entries={openEntries}
          project={open.project}
          title={open.transcriptTitle}
        />
      )
    : null;
  const versionMark = desktop
    ? <UpdateMark stage={updateProbe.stage} progress={updateProbe.progress} />
    : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="
        flex h-dvh flex-col overflow-hidden bg-recess text-foreground
      "
      >
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
          onArchiveSession={archivable ? archiveOpenSession : null}
          onNotice={(message) => {
            pushToast(message, 'error');
          }}
          actions={transcriptActions}
          overflow={transcriptOverflow}
        />
        {/* Below the titlebar, never above it: macOS puts the traffic lights at
            a fixed point in the window and only that row reserves room for them. */}
        <UpdateBanner />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/*
            * The rail sits at the window edge, ahead of the columns, so where
            * you are never scrolls away with what you are looking at.
            */}
          <NavRail
            flagged={findingCount}
            view={view}
            onViewChange={setView}
            onReload={projects.reload}
            showSettings={!nativeMenu}
            versionMark={versionMark}
            onOpenSettings={() => {
              runCommand('settings');
            }}
            onOpenAbout={() => {
              runCommand('about');
            }}
          />
          {/*
            * The sidebar sizes itself from the columns it holds open, so folding
            * one gives width back to the pane. The dividers are the gaps, so no gap class.
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
              <HistoryAppPane
                view={view}
                nowMs={nowMs}
                selectedProject={selectedProject}
                selectedSession={selectedSession}
                selectedFilePath={selectedFilePath}
                sessions={sessionList}
                reportScope={reportScope}
                highlightTimestamp={highlightTimestamp}
                openAgent={open.agent}
                openProfile={open.profile}
                openTitle={open.title}
                analyticsScope={analyticsScope}
                sessionCounts={sessionCounts}
                agentSetup={agentSetup}
                stats={stats}
                storage={storage}
                archives={archives}
                retention={retention}
                edits={edits}
                onEntriesLoaded={setOpenEntries}
                onOpenEdit={workspace.openEditedSession}
                onOpenStatsSession={workspace.openStatsSession}
                onOpenArchivedSession={workspace.openArchivedSession}
                onSelectAllProjects={selectAllProjects}
                onPluginToggle={togglePlugin}
              />
            </motion.div>
          </div>
        </div>

        <HistoryAppDialogs
          dialogs={dialogs}
          aboutOpen={aboutOpen}
          onCloseAbout={closeAbout}
          updateProbe={updateProbe}
          onCheckUpdate={desktop ? updateProbe.check : undefined}
          themeMode={theme.mode}
          onThemeChange={theme.setMode}
          search={search}
          projectNames={projectNames}
          onJump={workspace.jumpToHit}
        />
      </div>
    </MotionConfig>
  );
};
