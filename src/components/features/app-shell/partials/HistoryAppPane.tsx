import { useTranslation } from 'react-i18next';

import { AgentInstallSection, AgentSetupPanel } from '@features/agent-setup';
import { AnalyticsView } from '@features/analytics';
import { ArchiveView } from '@features/archive';
import { editsInSession, SessionViewer } from '@features/session-viewer';

import type { AgentId } from '@config/agents';
import type { AppView } from '@features/app-header';
import type {
  ReportScope,
  useAgentSetup,
  useArchives,
  useProjectStats,
  useRecentEdits,
  useRetention,
  useStorage,
} from '@features/history-data';
import type {
  HistoryEntry,
  ProjectSummary,
  SessionSummary,
} from '@services/history/historyService';
import type { ComponentProps, FC } from 'react';

export interface HistoryAppPaneProps {
  readonly view: AppView;
  readonly nowMs: number;
  readonly selectedProject: ProjectSummary | null;
  readonly selectedSession: SessionSummary | null;
  readonly selectedFilePath: string | null;
  readonly sessions: readonly SessionSummary[];
  readonly reportScope: ReportScope | null;
  readonly highlightTimestamp: ComponentProps<typeof SessionViewer>['highlightTimestamp'];
  readonly openAgent: AgentId;
  readonly openProfile: string | undefined;
  readonly openTitle: string | undefined;
  readonly analyticsScope: ComponentProps<typeof AnalyticsView>['scope'];
  readonly sessionCounts: Record<string, number>;
  readonly agentSetup: ReturnType<typeof useAgentSetup>;
  readonly stats: ReturnType<typeof useProjectStats>;
  readonly storage: ReturnType<typeof useStorage>;
  readonly archives: ReturnType<typeof useArchives>;
  readonly retention: ReturnType<typeof useRetention>;
  readonly edits: ReturnType<typeof useRecentEdits>;
  readonly onEntriesLoaded: (entries: readonly HistoryEntry[]) => void;
  readonly onOpenEdit: NonNullable<ComponentProps<typeof SessionViewer>['onOpenEdit']>;
  readonly onOpenStatsSession: ComponentProps<typeof AnalyticsView>['onOpenSession'];
  readonly onOpenArchivedSession: ComponentProps<typeof ArchiveView>['onOpenSession'];
  readonly onSelectAllProjects: () => void;
  readonly onPluginToggle: ComponentProps<typeof AgentSetupPanel>['onPluginToggle'];
}

const NO_TRUST: ComponentProps<typeof AgentSetupPanel>['trust'] = {
  known: false,
  trusted: false,
  onboarded: false,
};

export const HistoryAppPane: FC<HistoryAppPaneProps> = ({
  view,
  nowMs,
  selectedProject,
  selectedSession,
  selectedFilePath,
  sessions,
  reportScope,
  highlightTimestamp,
  openAgent,
  openProfile,
  openTitle,
  analyticsScope,
  sessionCounts,
  agentSetup,
  stats,
  storage,
  archives,
  retention,
  edits,
  onEntriesLoaded,
  onOpenEdit,
  onOpenStatsSession,
  onOpenArchivedSession,
  onSelectAllProjects,
  onPluginToggle,
}) => {
  const { t } = useTranslation('sidebar');

  if (view === 'sessions') {
    return (
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
          onOpenEdit={onOpenEdit}
          onEntriesLoaded={onEntriesLoaded}
        />
      </div>
    );
  }

  if (view === 'analytics') {
    return (
      <AnalyticsView
        stats={stats.data}
        storage={storage}
        status={stats.status}
        projectName={selectedProject?.name ?? t('noProject')}
        scope={analyticsScope}
        projectAgent={selectedProject?.agent}
        sessions={sessions}
        reportScope={reportScope}
        usage={agentSetup.data?.usage ?? null}
        nowMs={nowMs}
        onOpenSession={onOpenStatsSession}
      />
    );
  }

  if (view === 'archive') {
    return (
      <ArchiveView
        archives={archives}
        retention={retention}
        nowMs={nowMs}
        selectedProject={selectedProject}
        onShowAll={onSelectAllProjects}
        onOpenSession={onOpenArchivedSession}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <AgentSetupPanel
        projectSelected={selectedProject != null}
        projectPath={selectedProject?.actualPath ?? ''}
        status={agentSetup.status}
        setups={agentSetup.data?.setups ?? []}
        findings={agentSetup.data?.findings ?? []}
        usage={agentSetup.data?.usage ?? null}
        trust={agentSetup.data?.trust ?? NO_TRUST}
        sessionCounts={sessionCounts}
        nowMs={nowMs}
        onPluginToggle={onPluginToggle}
      />
      {/* A fact about this machine, not the project, so it reads last. */}
      <AgentInstallSection />
    </div>
  );
};
