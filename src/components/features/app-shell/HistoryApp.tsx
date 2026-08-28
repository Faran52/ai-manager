import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { initI18n } from '@i18n/index';
import { motion, MotionConfig } from 'motion/react';

import {
  deleteProject,
  deleteSession,
  renameSession,
} from '@lib/apis/apiClient';
import { findAgentProject } from '@services/history/historyService';

import { fadeTransition } from '@ui/index';
import { AgentSetupPanel } from '@features/agent-setup';
import { AnalyticsView } from '@features/analytics';
import { AppHeader } from '@features/app-header';
import {
  useAgentSetup,
  useProjects,
  useProjectStats,
  useSearch,
  useSessions,
} from '@features/history-data';
import { SearchDialog } from '@features/search';
import { SessionViewer } from '@features/session-viewer';
import { SidebarPane } from '@features/sidebar';
import { useTheme } from '@features/theme';
import { UpdateBanner } from '@features/updates';

import type { AgentId } from '@config/agents';
import type { AppView } from '@features/app-header';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { SearchHit } from '@services/search/searchService';
import type { SessionTokenTotals } from '@services/stats/statsService';
import type { FC, ReactNode } from 'react';

const EMPTY_PROJECTS: readonly ProjectSummary[] = [];

initI18n();

export const HistoryApp: FC = () => {
  const { t } = useTranslation('sidebar');
  const projects = useProjects();
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('sessions');
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightTimestamp, setHighlightTimestamp] = useState<string | undefined>(undefined);
  const [nowMs] = useState(() => {
    return Date.now();
  });
  const sessions = useSessions(selectedProject);
  const stats = useProjectStats(view === 'analytics' ? selectedProject : null);
  const agentSetup = useAgentSetup(view === 'health' ? (selectedProject?.actualPath ?? null) : null);
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
    const onKey = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.key !== '/') {
        return;
      }

      const target = event.target;

      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]')) {
        return;
      }

      if (!searchOpen) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [searchOpen]);

  const selectSession = useCallback((filePath: string) => {
    setSelectedFilePath(filePath);
    setHighlightTimestamp(undefined);
  }, []);

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

  const onRequestSessions = useCallback((): void => {
    /**
     * Sessions for expanded projects are loaded on demand.
     * Currently, the sessions for the selected project are already loaded.
     * In the future, this could trigger loading sessions for the expanded project.
     */
  }, []);

  const jumpToHit = useCallback(
    (hit: SearchHit) => {
      setView('sessions');
      setSelectedProject(findAgentProject(projects.data, hit.projectId, hit.agent));
      setSelectedFilePath(hit.filePath);
      setHighlightTimestamp(new Date(hit.timestampMs).toISOString());
    },
    [projects.data],
  );

  const openStatsSession = useCallback(
    (session: SessionTokenTotals) => {
      setView('sessions');
      setSelectedFilePath(session.filePath);
      setHighlightTimestamp(new Date(session.lastTimestampMs).toISOString());
    },
    [],
  );

  const showingSessions = view === 'sessions';

  const VIEWS: Record<AppView, ReactNode> = {
    sessions: (
      <SessionViewer
        filePath={selectedFilePath}
        agent={selectedSession?.agent ?? selectedProject?.agent ?? 'claude'}
        projectLabel={selectedProject?.name ?? ''}
        sessionTitle={selectedSession?.title ?? selectedSession?.summary ?? selectedSession?.preview}
        highlightTimestamp={highlightTimestamp}
      />
    ),
    analytics: (
      <AnalyticsView
        stats={stats.data}
        status={stats.status}
        projectName={selectedProject?.name ?? t('noProject')}
        onOpenSession={openStatsSession}
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

          <div className="
            grid min-h-0 flex-1
            grid-cols-[clamp(240px,24vw,300px)_minmax(0,1fr)] overflow-hidden
          "
          >
            <SidebarPane
              projects={visibleProjects}
              projectsStatus={projects.status}
              sessions={showingSessions ? sessions.data ?? [] : []}
              sessionsStatus={showingSessions ? sessions.status : 'ready'}
              selectedFilePath={showingSessions ? selectedFilePath : null}
              onSelectSession={selectSession}
              onDeleteProject={deleteSelectedProject}
              onRenameSession={renameSelectedSession}
              onDeleteSession={deleteSelectedSession}
              onRequestSessions={onRequestSessions}
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
