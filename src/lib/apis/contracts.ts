import type { AgentId } from '@config/agents';
import type {
  AgentSetup,
  InstalledPlugin,
  ProjectTrust,
  ProjectUsage,
  SetupFinding,
} from '@services/agents/agentsService';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { SearchOutcome } from '@services/search/searchService';
import type { SessionPage } from '@services/session/sessionService';
import type { ProjectStats } from '@services/stats/statsService';

export interface ProjectsResponse {
  readonly projects: readonly ProjectSummary[];
}

export interface SessionsResponse {
  readonly sessions: readonly SessionSummary[];
}

export interface ListSessionsBody {
  readonly projectId: string;
  readonly agent: AgentId;
}

export interface LoadSessionBody {
  readonly filePath: string;
  readonly agent: AgentId;
  readonly offset?: number | undefined;
  readonly limit?: number | undefined;
  readonly includeSidechain?: boolean | undefined;
}

export interface SearchBody {
  readonly query: string;
  readonly projectId?: string | undefined;
}

export interface ProjectStatsBody {
  readonly projectId: string;
  readonly agent: AgentId;
}

export type MessagesResponse = SessionPage;

export type SearchResponse = SearchOutcome;

export interface StatsResponse {
  readonly stats: ProjectStats | null;
}

export interface SessionMutationBody {
  readonly agent: AgentId;
  readonly filePath: string;
  readonly actualSessionId: string;
}

export interface ProjectMutationBody {
  readonly agent: AgentId;
  readonly projectId: string;
}

export interface RenameSessionBody extends SessionMutationBody {
  readonly title: string;
}

export interface MutationResponse {
  readonly ok: true;
}

export interface AgentSetupBody {
  readonly projectPath: string;
}

export interface AgentSetupResponse {
  readonly setups: readonly AgentSetup[];
  readonly findings: readonly SetupFinding[];
  readonly usage: ProjectUsage | null;
  readonly plugins: readonly InstalledPlugin[];
  readonly trust: ProjectTrust;
}
