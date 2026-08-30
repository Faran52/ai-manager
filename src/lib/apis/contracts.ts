import type { AgentId } from '@config/agents';
import type {
  AgentSetup,
  InstalledPlugin,
  ProjectTrust,
  ProjectUsage,
  SetupFinding,
} from '@services/agents/agentsService';
import type { ArchiveManifest, ArchiveSummary } from '@services/archive/archiveService';
import type { EditedFile } from '@services/edits/editsService';
import type { FileHistory, FileVersionDiff } from '@services/file-history/fileHistoryService';
import type { ProjectSummary, SessionSummary } from '@services/history/historyService';
import type { PromptHistory } from '@services/prompts/promptsService';
import type {
  RetentionDue,
  RetentionPolicy,
  RetentionRun,
} from '@services/retention/retentionService';
import type { SearchOutcome } from '@services/search/searchService';
import type { SessionPage } from '@services/session/sessionService';
import type {
  ScopeSettings,
  SettingsPatch,
  SettingsScope,
} from '@services/settings/settingsService';
import type { ProjectStats } from '@services/stats/statsService';
import type { ReclaimResult, StorageReport } from '@services/storage/storageService';

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

export interface ArchivesResponse {
  readonly archives: readonly ArchiveSummary[];
}

export interface ArchiveBody {
  readonly id: string;
}

export interface ArchiveDetailResponse {
  readonly archive: ArchiveManifest | null;
}

export interface CreateArchiveBody {
  readonly note?: string | undefined;
  // Session keys to capture. Absent means every session the agents still hold.
  readonly sessionKeys?: readonly string[] | undefined;
}

export interface CreateArchiveResponse {
  readonly archive: ArchiveSummary;
}

export interface RetentionStatusResponse {
  readonly policy: RetentionPolicy;
  readonly due: RetentionDue;
}

export interface WriteRetentionBody {
  readonly policy: RetentionPolicy;
}

export interface RunRetentionResponse {
  readonly result: RetentionRun;
}

/* Both absent means the whole machine rather than one project. */
export interface RecentEditsBody {
  readonly agent?: AgentId | undefined;
  readonly projectId?: string | undefined;
}

export interface RecentEditsResponse {
  readonly files: readonly EditedFile[];
}

export interface ReclaimBody {
  readonly paths: readonly string[];
}

export interface ReclaimResponse {
  readonly result: ReclaimResult;
}

export interface FileHistoryBody {
  readonly sessionId: string;
  readonly path: string;
  readonly version?: number | undefined;
}

export interface FileHistoryResponse {
  readonly history: FileHistory;
  readonly diff: FileVersionDiff | null;
}

export type PromptsResponse = PromptHistory;

export type StorageResponse = StorageReport;

export interface SettingsBody {
  readonly projectPath: string;
}

export interface SettingsResponse {
  readonly scopes: readonly ScopeSettings[];
}

export interface WriteSettingsBody extends SettingsBody {
  readonly scope: SettingsScope;
  readonly patch: SettingsPatch;
}

export interface WriteSettingsResponse {
  readonly scope: ScopeSettings;
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

export interface UpdateCheckResponse {
  readonly update: {
    readonly notes?: string | undefined;
    readonly stage: string;
    readonly version?: string | undefined;
  };
}
