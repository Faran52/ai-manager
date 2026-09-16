import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AnimatePresence } from 'motion/react';

import { agentBadgeLabel } from '@config/agents';

import { useMutationRunner } from '@ui/index';

import {
  PROJECTS_WIDTH,
  SESSIONS_WIDTH,
  usePaneLayout,
} from './hooks/usePaneLayout';
import { useSessionFilters } from './hooks/useSessionFilters';
import { useSessionSelection } from './hooks/useSessionSelection';
import {
  ColumnGap,
  ConfirmDeleteDialog,
  ConfirmDeleteProjectDialog,
  ProjectsColumn,
  RenameSessionDialog,
  SessionsColumn,
  SidebarContextMenu,
} from './partials';

import type { AgentId } from '@config/agents';
import type { ReportScope } from '@features/history-data';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { PopupPosition } from '@ui/index';
import type { FC, MouseEvent } from 'react';
import type { SidebarMenuTarget } from './partials';

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

/*
 * The two folding columns, and everything that floats above them: the
 * context menu, the rename and delete dialogs, and the live-region lines
 * that read out what those did.
 */
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
  const { t } = useTranslation('sidebar');
  const layout = usePaneLayout();
  const filters = useSessionFilters(sessions, nowMs);
  const mutation = useMutationRunner();
  const [menuTarget, setMenuTarget] = useState<SidebarMenuTarget | null>(null);
  const [menuPosition, setMenuPosition] = useState<PopupPosition>({
    x: 0,
    y: 0,
  });
  const [copiedLabel, setCopiedLabel] = useState('');
  const [renameTarget, setRenameTarget] = useState<SessionSummary | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<ProjectSummary | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<readonly SessionSummary[]>([]);
  // Escape belongs to the delete dialog while it is up, not to selection mode.
  const selection = useSessionSelection(sessions, filters.visibleSessions, deleteTargets.length > 0);

  // "All Projects" plus one report agent scopes the session list the same way
  // a single project does; only picking neither leaves it unscoped.
  const sessionsScoped = selectedProject != null || reportScope != null;

  /**
   * A project names the export same as always; with none selected, a report
   * agent's own sessions are named for that agent rather than the generic
   * fallback both call sites otherwise use.
   */
  const scopeName = selectedProject?.name
    ?? (reportScope != null ? agentBadgeLabel(reportScope.agent, reportScope.profile) : undefined);

  const openMenu = (event: MouseEvent, target: SidebarMenuTarget): void => {
    event.preventDefault();
    setMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
    setMenuTarget(target);
  };

  // Changing scope drops any half-made selection: the rows it named are gone.
  const selectProject = (project: ProjectSummary): void => {
    selection.exit();
    onSelectProject(project);
  };

  const selectAllProjects = (): void => {
    selection.exit();
    onSelectAllProjects();
  };

  // Each dialog closes itself only once its action settled cleanly.
  const runRename = async (session: SessionSummary, title: string): Promise<void> => {
    if (await mutation.run(() => {
      return onRenameSession(session, title);
    })) {
      setRenameTarget(null);
    }
  };

  const runDeleteProject = async (project: ProjectSummary): Promise<void> => {
    if (await mutation.run(() => {
      return onDeleteProject(project);
    })) {
      setDeleteProjectTarget(null);
    }
  };

  const runDelete = async (targets: readonly SessionSummary[]): Promise<void> => {
    const done = await mutation.run(async () => {
      for (const session of targets) {
        await onDeleteSession(session);
      }
    });

    if (done) {
      setDeleteTargets([]);
      selection.exit();
    }
  };

  return (
    <aside className="flex min-h-0 shrink-0 overflow-hidden" data-sidebar>
      <ProjectsColumn
        open={layout.projectsOpen}
        width={layout.projectsWidth}
        onOpen={() => {
          layout.setProjectsOpen(true);
        }}
        onClose={() => {
          layout.setProjectsOpen(false);
        }}
        projects={projects}
        projectsStatus={projectsStatus}
        selectedProject={selectedProject}
        nowMs={nowMs}
        wholeMachine={wholeMachine}
        reportScope={reportScope}
        showAllProjects={showAllProjects}
        showAgentChips={showAgentChips}
        onSelectProject={selectProject}
        onSelectAllProjects={selectAllProjects}
        onSelectReportAgent={onSelectReportAgent}
        onOpenMenu={(event, project) => {
          openMenu(event, {
            kind: 'project',
            project,
          });
        }}
      />
      <ColumnGap
        resizable={layout.projectsOpen}
        label={t('resize')}
        value={layout.projectsWidth}
        range={PROJECTS_WIDTH}
        onResize={layout.resizeProjects}
      />
      {/* The session list rides with the Sessions view alone: Health and
          Archive read the projects column, and a list of sessions under a
          report it cannot open is one more thing to look past. */}
      <AnimatePresence initial={false}>
        {showSessions && (
          <SessionsColumn
            key="sessions-column"
            open={layout.sessionsOpen}
            width={layout.sessionsWidth}
            onOpen={() => {
              layout.setSessionsOpen(true);
            }}
            onClose={() => {
              layout.setSessionsOpen(false);
            }}
            sessions={sessions}
            sessionsStatus={sessionsStatus}
            scoped={sessionsScoped}
            scopeName={scopeName}
            filters={filters}
            selection={selection}
            selectedFilePath={selectedFilePath}
            projectNames={reportScope != null ? projectNames : null}
            nowMs={nowMs}
            onSelectSession={onSelectSession}
            onOpenMenu={(event, session) => {
              openMenu(event, {
                kind: 'session',
                session,
              });
            }}
            onDeleteSessions={setDeleteTargets}
          />
        )}
      </AnimatePresence>
      {showSessions && (
        <ColumnGap
          resizable={layout.sessionsOpen}
          label={t('resizeSidebar')}
          value={layout.sessionsWidth}
          range={SESSIONS_WIDTH}
          onResize={layout.resizeSessions}
        />
      )}
      {menuTarget != null && !selection.active && (
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
        busy={mutation.busy}
        onClose={() => {
          setRenameTarget(null);
        }}
        onConfirm={(session, title) => {
          void runRename(session, title);
        }}
      />
      <ConfirmDeleteProjectDialog
        project={deleteProjectTarget}
        busy={mutation.busy}
        onClose={() => {
          setDeleteProjectTarget(null);
        }}
        onConfirm={(project) => {
          void runDeleteProject(project);
        }}
      />
      <ConfirmDeleteDialog
        sessions={deleteTargets}
        busy={mutation.busy}
        onClose={() => {
          setDeleteTargets([]);
        }}
        onConfirm={(targets) => {
          void runDelete(targets);
        }}
      />
      {copiedLabel.length > 0 && <span className="sr-only" role="status">{copiedLabel}</span>}
      {mutation.error.length > 0 && <span className="sr-only" role="alert">{mutation.error}</span>}
    </aside>
  );
};
