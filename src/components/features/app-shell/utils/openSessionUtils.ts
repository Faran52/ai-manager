import type { AgentId } from '@config/agents';
import type { ArchivedSession } from '@services/archive/archiveService';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';

export interface OpenSessionSources {
  readonly archivedSession: ArchivedSession | null;
  readonly selectedSession: SessionSummary | null;
  readonly selectedProject: ProjectSummary | null;
  readonly selectedFilePath: string | null;
  readonly fallbackTitle: string;
}

export interface OpenSessionFacts {
  readonly agent: AgentId;
  readonly profile: string | undefined;
  readonly title: string | undefined;
  readonly project: string;
  readonly transcriptTitle: string;
}

export const openSessionFacts = (sources: OpenSessionSources): OpenSessionFacts => {
  const {
    archivedSession,
    selectedSession,
    selectedProject,
    selectedFilePath,
    fallbackTitle,
  } = sources;
  const title = archivedSession?.title
    ?? selectedSession?.title
    ?? selectedSession?.summary
    ?? selectedSession?.preview;

  return {
    agent: archivedSession?.agent ?? selectedSession?.agent ?? selectedProject?.agent ?? 'claude',
    profile: selectedSession?.profile ?? selectedProject?.profile,
    title,
    project: archivedSession?.projectName ?? selectedProject?.name ?? '',
    transcriptTitle: title ?? selectedFilePath?.split('/').at(-1) ?? fallbackTitle,
  };
};
