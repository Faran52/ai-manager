import { useCallback, useState } from 'react';

import { findAgentProject } from '@services/history/historyService';

import type { AgentId } from '@config/agents';
import type { ReportScope } from '@features/history-data';
import type { ArchivedSession } from '@services/archive/archiveService';
import type { FileEdit } from '@services/edits/editsService';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { SearchHit } from '@services/search/searchService';
import type { SessionTokenTotals } from '@services/stats/statsService';

export interface WorkspaceSelection {
  readonly selectedProject: ProjectSummary | null;
  readonly selectedFilePath: string | null;
  // The one agent (and profile) a global report is scoped to; see ReportScope.
  readonly reportScope: ReportScope | null;
  readonly highlightTimestamp: string | undefined;
  readonly archivedSession: ArchivedSession | null;
  readonly setSelectedProject: (project: ProjectSummary | null) => void;
  readonly setSelectedFilePath: (filePath: string | null) => void;
  readonly selectProject: (project: ProjectSummary) => void;
  readonly selectAllProjects: () => void;
  readonly selectReportAgent: (agent: AgentId, profile?: string) => void;
  readonly selectSession: (session: SessionSummary) => void;
  readonly jumpToHit: (hit: SearchHit) => void;
  readonly openArchivedSession: (session: ArchivedSession) => void;
  readonly openEditedSession: (edit: FileEdit) => void;
  readonly openStatsSession: (session: SessionTokenTotals) => void;
}

/*
 * What the app is pointed at. Every way of opening a transcript lands on the
 * Sessions view, which `showSession` does.
 */
export const useWorkspaceSelection = (
  projects: readonly ProjectSummary[] | undefined,
  showSession: () => void,
): WorkspaceSelection => {
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [reportScope, setReportScope] = useState<ReportScope | null>(null);
  const [highlightTimestamp, setHighlightTimestamp] = useState<string | undefined>(undefined);
  const [archivedSession, setArchivedSession] = useState<ArchivedSession | null>(null);

  // The three ways to rescope the sidebar are mutually exclusive, so sharing this
  // reset is what stops a fourth caller repeating the bug where it was missed.
  const clearOpenSession = useCallback(() => {
    setSelectedFilePath(null);
    setHighlightTimestamp(undefined);
    setArchivedSession(null);
  }, []);

  const selectProject = useCallback((project: ProjectSummary) => {
    setSelectedProject(project);
    clearOpenSession();
    setReportScope(null);
  }, [clearOpenSession]);

  // The All Projects card is a sibling of the project list, so picking it clears
  // the previous pick rather than leaving it marked selected.
  const selectAllProjects = useCallback(() => {
    setSelectedProject(null);
    clearOpenSession();
    setReportScope(null);
  }, [clearOpenSession]);

  /*
   * Picking an agent means the whole machine: there is no per-project, per-agent
   * report. profile is part of the toggle identity, so a sibling switches.
   */
  const selectReportAgent = useCallback((agent: AgentId, profile?: string) => {
    setSelectedProject(null);
    clearOpenSession();
    setReportScope((current) => {
      return current?.agent === agent && current.profile === profile
        ? null
        : {
            agent,
            profile,
          };
    });
  }, [clearOpenSession]);

  const selectSession = useCallback((session: SessionSummary) => {
    setSelectedProject(findAgentProject(projects, session.projectId, session.agent, session.profile));
    setSelectedFilePath(session.filePath);
    setHighlightTimestamp(undefined);
    setArchivedSession(null);
    showSession();
  }, [projects, showSession]);

  const jumpToHit = useCallback((hit: SearchHit) => {
    showSession();
    setSelectedProject(findAgentProject(projects, hit.projectId, hit.agent, hit.profile));
    setSelectedFilePath(hit.filePath);
    setHighlightTimestamp(new Date(hit.timestampMs).toISOString());
  }, [projects, showSession]);

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

  const openStatsSession = useCallback((session: SessionTokenTotals) => {
    showSession();
    // A top session can come from a per-agent global rollup, so it is not
    // necessarily under the project already selected.
    setSelectedProject(findAgentProject(projects, session.projectId, session.agent, session.profile));
    setSelectedFilePath(session.filePath);
    setHighlightTimestamp(new Date(session.lastTimestampMs).toISOString());
  }, [projects, showSession]);

  return {
    selectedProject,
    selectedFilePath,
    reportScope,
    highlightTimestamp,
    archivedSession,
    setSelectedProject,
    setSelectedFilePath,
    selectProject,
    selectAllProjects,
    selectReportAgent,
    selectSession,
    jumpToHit,
    openArchivedSession,
    openEditedSession,
    openStatsSession,
  };
};
