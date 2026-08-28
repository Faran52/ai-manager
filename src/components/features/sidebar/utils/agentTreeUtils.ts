import type { AgentId } from '@config/agents';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';

export interface TreeAgent {
  readonly agent: AgentId;
  readonly projectCount: number;
  readonly sessionCount: number;
  readonly lastActivityMs: number;
  readonly projects: readonly TreeProject[];
  readonly matchesFilter: boolean;
}

export interface TreeProject {
  readonly agent: AgentId;
  readonly id: string;
  readonly name: string;
  readonly actualPath: string | undefined;
  readonly sessionCount: number;
  readonly messageCount: number;
  readonly lastActivityMs: number;
  readonly sessions: readonly TreeSession[];
  readonly matchesFilter: boolean;
}

export interface TreeSession {
  readonly agent: AgentId;
  readonly actualSessionId: string;
  readonly id: string;
  readonly filePath: string;
  readonly projectId: string;
  readonly title?: string | undefined;
  readonly summary?: string | undefined;
  readonly preview?: string | undefined;
  readonly messageCount: number;
  readonly firstTimestampMs: number;
  readonly lastTimestampMs: number;
  readonly modifiedMs: number;
  readonly sizeBytes: number;
  readonly cwd?: string | undefined;
  readonly matchesFilter: boolean;
}

export interface BuildAgentTreeOptions {
  readonly agentFilter: readonly AgentId[];
  readonly textFilter: string;
  readonly selectedFilePath: string | null;
}

export const buildAgentTree = (
  projects: readonly ProjectSummary[],
  sessions: readonly SessionSummary[],
  options: BuildAgentTreeOptions,
): readonly TreeAgent[] => {
  const { agentFilter, textFilter } = options;
  const needle = textFilter.trim().toLowerCase();

  // Map.groupBy rather than a hand-rolled accumulator: rebuilding the array on
  // every insert would make grouping quadratic in the session count.
  const sessionsByProject = Map.groupBy(sessions, (session) => {
    return `${session.agent}:${session.projectId}`;
  });

  const agentsMap = Map.groupBy(projects.filter((project) => {
    return agentFilter.length === 0 || agentFilter.includes(project.agent);
  }), (project) => {
    return project.agent;
  });

  const agentEntries: TreeAgent[] = [];
  for (const [agent, agentProjects] of agentsMap.entries()) {
    let agentSessionCount = 0;
    let agentLastActivityMs = 0;
    const treeProjects: TreeProject[] = [];

    for (const project of agentProjects) {
      const projectSessions = sessionsByProject.get(`${agent}:${project.id}`) ?? [];
      const projectSessionCount = projectSessions.length;
      agentSessionCount += projectSessionCount;

      const projectLastActivity = project.lastActivityMs;
      if (projectLastActivity > agentLastActivityMs) {
        agentLastActivityMs = projectLastActivity;
      }

      const treeSessions: TreeSession[] = projectSessions.map((session) => {
        return {
          ...session,
          matchesFilter: needle.length === 0 || sessionMatchesFilter(session, needle),
        };
      });

      const projectMatchesFilter
        = needle.length === 0
          || project.name.toLowerCase().includes(needle)
          || treeSessions.some((s) => {
            return s.matchesFilter;
          });

      treeProjects.push({
        agent: project.agent,
        id: project.id,
        name: project.name,
        actualPath: project.actualPath,
        sessionCount: project.sessionCount,
        messageCount: project.messageCount,
        lastActivityMs: project.lastActivityMs,
        sessions: treeSessions,
        matchesFilter: projectMatchesFilter,
      });
    }

    treeProjects.sort((a, b) => {
      return b.lastActivityMs - a.lastActivityMs;
    });

    const agentMatchesFilter
      = treeProjects.some((p) => {
        return p.matchesFilter;
      });

    agentEntries.push({
      agent,
      projectCount: treeProjects.length,
      sessionCount: agentSessionCount,
      lastActivityMs: agentLastActivityMs,
      projects: treeProjects,
      matchesFilter: agentMatchesFilter,
    });
  }

  agentEntries.sort((a, b) => {
    return b.lastActivityMs - a.lastActivityMs;
  });

  return agentEntries;
};

const sessionMatchesFilter = (session: SessionSummary, needle: string): boolean => {
  const haystack = `${session.title ?? ''} ${session.summary ?? ''} ${session.preview ?? ''}`.toLowerCase();
  return haystack.includes(needle);
};
