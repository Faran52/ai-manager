import { useMemo } from 'react';

import { projectKeyOf } from '@services/history/historyService';

import { setupKey, usePluginToggle } from '@features/agent-setup';
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

import type { AppView } from '@features/app-header';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { WorkspaceSelection } from './useWorkspaceSelection';

export interface HistoryAppData {
  readonly projects: ReturnType<typeof useProjects>;
  readonly visibleProjects: readonly ProjectSummary[];
  readonly sessions: ReturnType<typeof useSessions>;
  readonly sessionList: readonly SessionSummary[];
  readonly selectedSession: SessionSummary | null;
  readonly projectNames: ReadonlyMap<string, string>;
  readonly sessionCounts: Record<string, number>;
  readonly stats: ReturnType<typeof useProjectStats>;
  readonly agentSetup: ReturnType<typeof useAgentSetup>;
  readonly togglePlugin: ReturnType<typeof usePluginToggle>;
  readonly archives: ReturnType<typeof useArchives>;
  readonly retention: ReturnType<typeof useRetention>;
  readonly storage: ReturnType<typeof useStorage>;
  readonly edits: ReturnType<typeof useRecentEdits>;
  readonly search: ReturnType<typeof useSearch>;
  readonly findingCount: number;
}

const EMPTY_PROJECTS: readonly ProjectSummary[] = [];

export const useHistoryAppData = (
  view: AppView,
  projects: ReturnType<typeof useProjects>,
  workspace: WorkspaceSelection,
): HistoryAppData => {
  const {
    selectedProject,
    selectedFilePath,
    reportScope,
  } = workspace;
  const visibleProjects = projects.data ?? EMPTY_PROJECTS;

  /*
   * Only the one the pane is about reads. Both are live and the agent list fans
   * out a request per project, so the idle one polled for an answer nobody read.
   */
  const projectSessions = useSessions(reportScope == null ? selectedProject : null);
  const agentSessions = useAgentSessions(reportScope, visibleProjects);
  const sessions = reportScope == null ? projectSessions : agentSessions;
  const projectPath = selectedProject?.actualPath ?? '';
  // Ungated: the rail carries Health's finding count on every screen.
  const agentSetup = useAgentSetup(projectPath);

  const data = {
    stats: useProjectStats(view === 'analytics' ? selectedProject : null),
    togglePlugin: usePluginToggle(projectPath, agentSetup.reload),
    archives: useArchives(view === 'archive'),
    retention: useRetention(view === 'archive'),
    storage: useStorage(view === 'analytics'),
    // The transcript's edits panel reads this list, narrowed to the open session.
    edits: useRecentEdits(selectedProject, view === 'sessions'),
    search: useSearch(),
  };

  const sessionCounts = useMemo(() => {
    const path = selectedProject?.actualPath;

    return (projects.data ?? EMPTY_PROJECTS).reduce<Record<string, number>>((totals, project) => {
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
      return [projectKeyOf(project.agent, project.id), project.name];
    }));
  }, [visibleProjects]);

  return {
    ...data,
    projects,
    visibleProjects,
    sessions,
    sessionList: sessions.data ?? [],
    selectedSession,
    projectNames,
    sessionCounts,
    agentSetup,
    findingCount: (agentSetup.data?.findings ?? []).length,
  };
};
