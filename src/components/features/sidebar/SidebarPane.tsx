import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { FolderClosed } from 'lucide-react';

import { agentOption } from '@config/agents';

import { toErrorMessage } from '@utils/errorUtils';

import { SectionHeader, TextInput } from '@ui/index';

import {
  AgentFilterBar,
  ConfirmDeleteDialog,
  ConfirmDeleteProjectDialog,
  ProjectTree,
  RenameSessionDialog,
  SessionSelectionBar,
  SidebarContextMenu,
} from './partials';

import type { AgentId } from '@config/agents';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { PopupPosition } from '@ui/index';
import type { FC } from 'react';
import type { SidebarMenuTarget } from './partials';

export interface SidebarPaneProps {
  readonly projects: readonly ProjectSummary[];
  readonly projectsStatus: 'loading' | 'ready' | 'error';
  readonly sessions: readonly SessionSummary[];
  readonly sessionsStatus: 'loading' | 'ready' | 'error';
  readonly selectedFilePath: string | null;
  readonly onSelectSession: (filePath: string) => void;
  readonly onDeleteProject: (project: ProjectSummary) => Promise<void>;
  readonly onRenameSession: (session: SessionSummary, title: string) => Promise<void>;
  readonly onDeleteSession: (session: SessionSummary) => Promise<void>;
  readonly onRequestSessions: (agent: AgentId, projectId: string) => void;
}

export const SidebarPane: FC<SidebarPaneProps> = ({
  projects,
  projectsStatus,
  sessions,
  sessionsStatus,
  selectedFilePath,
  onSelectSession,
  onDeleteProject,
  onRenameSession,
  onDeleteSession,
  onRequestSessions,
}) => {
  const { t } = useTranslation('sidebar');
  const [filter, setFilter] = useState('');
  const [menuTarget, setMenuTarget] = useState<SidebarMenuTarget | null>(null);
  const [menuPosition, setMenuPosition] = useState<PopupPosition>({
    x: 0,
    y: 0,
  });
  const [copiedLabel, setCopiedLabel] = useState('');

  const openMenu = (event: React.MouseEvent, target: SidebarMenuTarget): void => {
    event.preventDefault();
    setMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
    setMenuTarget(target);
  };
  const [activeAgents, setActiveAgents] = useState<readonly AgentId[]>([]);
  const [renameTarget, setRenameTarget] = useState<SessionSummary | null>(null);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<ProjectSummary | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<readonly SessionSummary[]>([]);
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

  const selectableSessions = useMemo(() => {
    return sessions.filter((session) => {
      return agentOption(session.agent).canDelete;
    });
  }, [sessions]);

  const selectedSessions = useMemo(() => {
    return sessions.filter((session) => {
      return selectedSessionPaths.includes(session.filePath);
    });
  }, [selectedSessionPaths, sessions]);

  const allSelectableSelected = selectableSessions.length > 0
    && selectableSessions.every((session) => {
      return selectedSessionPaths.includes(session.filePath);
    });

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

  const toggleSessionSelection = (session: SessionSummary): void => {
    setSelectedSessionPaths((current) => {
      if (current.includes(session.filePath)) {
        return current.filter((filePath) => {
          return filePath !== session.filePath;
        });
      }

      return [...current, session.filePath];
    });
  };

  const toggleAllSessions = (): void => {
    setSelectedSessionPaths(allSelectableSelected
      ? []
      : selectableSessions.map((session) => {
          return session.filePath;
        }));
  };

  const handleSessionSelect = (session: SessionSummary): void => {
    if (selectionMode) {
      toggleSessionSelection(session);
    }
    else {
      onSelectSession(session.filePath);
    }
  };

  return (
    <aside
      className="
        flex min-h-0 w-full flex-col overflow-hidden border-r border-border
        bg-card/80
      "
      data-sidebar
    >
      <section className="flex min-h-0 flex-1 flex-col">
        <SectionHeader
          icon={<FolderClosed className="size-3.5" />}
          label={t('projects')}
          action={(
            <AgentFilterBar
              active={activeAgents}
              available={availableAgents}
              counts={agentCounts}
              onChange={setActiveAgents}
            />
          )}
        />
        <div className="shrink-0 px-2 pb-1.5">
          <TextInput
            value={filter}
            onInput={setFilter}
            label={t('filterProjects')}
            placeholder={t('filterProjects')}
          />
        </div>
        <ProjectTree
          projects={projects}
          sessions={sessions}
          projectsStatus={projectsStatus}
          sessionsStatus={sessionsStatus}
          agentFilter={activeAgents}
          textFilter={filter}
          selectedFilePath={selectedFilePath}
          selectionMode={selectionMode}
          selectedSessionPaths={selectedSessionPaths}
          onSessionSelect={handleSessionSelect}
          onOpenMenu={openMenu}
          onRequestSessions={onRequestSessions}
        />
      </section>
      {selectionMode && (
        <SessionSelectionBar
          selectedCount={selectedSessions.length}
          allSelected={allSelectableSelected}
          onToggleAll={toggleAllSessions}
          onDelete={() => {
            setDeleteTargets(selectedSessions);
          }}
        />
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
      {copiedLabel.length > 0 && <span className="sr-only" role="status">{copiedLabel}</span>}
      {mutationError.length > 0 && <span className="sr-only" role="alert">{mutationError}</span>}
    </aside>
  );
};
