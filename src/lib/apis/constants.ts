import type {
  AgentInstallCheckResponse,
  AgentSetupResponse,
  ArchiveDetailResponse,
  ArchivesResponse,
  CreateArchiveResponse,
  FileHistoryResponse,
  MessagesResponse,
  MutationResponse,
  PluginCostsResponse,
  ProjectsResponse,
  RecentEditsResponse,
  ReclaimResponse,
  RetentionStatusResponse,
  RunRetentionResponse,
  SearchResponse,
  SessionsResponse,
  SettingsResponse,
  StatsResponse,
  StorageResponse,
  WriteSettingsResponse,
} from './contracts';

/*
 * One definition per route. The guard is why the client hands back a typed
 * value without a cast: an answer that fails it is rejected, not trusted.
 */
export interface EndpointDefinition<T extends object> {
  readonly path: string;
  readonly accepts: (value: object) => value is T;
  readonly label: string;
}

export const isAgentSetupResponse = (value: object): value is AgentSetupResponse => {
  return 'setups' in value && Array.isArray(value.setups);
};

const isAgentInstallCheckResponse = (value: object): value is AgentInstallCheckResponse => {
  return 'agents' in value && typeof value.agents === 'object' && value.agents !== null;
};

const hasCosts = (value: object): value is PluginCostsResponse => {
  return 'costs' in value && Array.isArray(value.costs);
};

const hasProjects = (value: object): value is ProjectsResponse => {
  return 'projects' in value && Array.isArray(value.projects);
};

const hasSessions = (value: object): value is SessionsResponse => {
  return 'sessions' in value && Array.isArray(value.sessions);
};

const isMessagesPage = (value: object): value is MessagesResponse => {
  return 'entries' in value && Array.isArray(value.entries) && 'total' in value;
};

const isSearchOutcome = (value: object): value is SearchResponse => {
  return 'hits' in value && Array.isArray(value.hits) && 'truncated' in value;
};

const isStatsResponse = (value: object): value is StatsResponse => {
  return 'stats' in value;
};

const isMutationResponse = (value: object): value is MutationResponse => {
  return 'ok' in value && value.ok === true;
};

const hasArchives = (value: object): value is ArchivesResponse => {
  return 'archives' in value && Array.isArray(value.archives);
};

const isArchiveDetail = (value: object): value is ArchiveDetailResponse => {
  return 'archive' in value;
};

const hasStorage = (value: object): value is StorageResponse => {
  return 'agents' in value && Array.isArray(value.agents) && 'totalBytes' in value;
};

const hasFiles = (value: object): value is RecentEditsResponse => {
  return 'files' in value && Array.isArray(value.files);
};

const hasReclaimResult = (value: object): value is ReclaimResponse => {
  return 'result' in value
    && typeof value.result === 'object'
    && value.result !== null
    && 'removed' in value.result
    && Array.isArray(value.result.removed);
};

const hasHistory = (value: object): value is FileHistoryResponse => {
  return 'history' in value
    && typeof value.history === 'object'
    && value.history !== null
    && 'versions' in value.history
    && Array.isArray(value.history.versions);
};

export const hasScopes = (value: object): value is SettingsResponse => {
  return 'scopes' in value && Array.isArray(value.scopes);
};

const isWrittenScope = (value: object): value is WriteSettingsResponse => {
  return 'scope' in value && typeof value.scope === 'object' && value.scope !== null;
};

const isCreatedArchive = (value: object): value is CreateArchiveResponse => {
  return 'archive' in value && typeof value.archive === 'object' && value.archive !== null;
};

export const PROJECTS: EndpointDefinition<ProjectsResponse> = {
  path: '/api/projects',
  accepts: hasProjects,
  label: 'project list',
};
export const SESSIONS: EndpointDefinition<SessionsResponse> = {
  path: '/api/sessions',
  accepts: hasSessions,
  label: 'session list',
};
export const MESSAGES: EndpointDefinition<MessagesResponse> = {
  path: '/api/messages',
  accepts: isMessagesPage,
  label: 'session messages',
};
export const SEARCH: EndpointDefinition<SearchResponse> = {
  path: '/api/search',
  accepts: isSearchOutcome,
  label: 'search results',
};
export const STATS: EndpointDefinition<StatsResponse> = {
  path: '/api/stats',
  accepts: isStatsResponse,
  label: 'statistics',
};
export const DELETE_SESSION: EndpointDefinition<MutationResponse> = {
  path: '/api/session-delete',
  accepts: isMutationResponse,
  label: 'session deletion',
};
export const DELETE_PROJECT: EndpointDefinition<MutationResponse> = {
  path: '/api/project-delete',
  accepts: isMutationResponse,
  label: 'project deletion',
};
export const AGENT_SETUP: EndpointDefinition<AgentSetupResponse> = {
  path: '/api/agent-setup',
  accepts: isAgentSetupResponse,
  label: 'agent setup',
};
export const PLUGIN_ACTION: EndpointDefinition<MutationResponse> = {
  path: '/api/plugin-action',
  accepts: isMutationResponse,
  label: 'plugin action',
};
export const AGENT_INSTALL_CHECK: EndpointDefinition<AgentInstallCheckResponse> = {
  path: '/api/agent-install-check',
  accepts: isAgentInstallCheckResponse,
  label: 'agent install check',
};
export const AGENT_INSTALL: EndpointDefinition<MutationResponse> = {
  path: '/api/agent-install',
  accepts: isMutationResponse,
  label: 'agent install',
};
export const PLUGIN_COSTS: EndpointDefinition<PluginCostsResponse> = {
  path: '/api/plugin-costs',
  accepts: hasCosts,
  label: 'plugin cost attribution',
};
export const ARCHIVES: EndpointDefinition<ArchivesResponse> = {
  path: '/api/archives',
  accepts: hasArchives,
  label: 'archive list',
};
export const ARCHIVE_READ: EndpointDefinition<ArchiveDetailResponse> = {
  path: '/api/archive-read',
  accepts: isArchiveDetail,
  label: 'archive contents',
};
export const ARCHIVE_CREATE: EndpointDefinition<CreateArchiveResponse> = {
  path: '/api/archive-create',
  accepts: isCreatedArchive,
  label: 'archive creation',
};
export const ARCHIVE_DELETE: EndpointDefinition<MutationResponse> = {
  path: '/api/archive-delete',
  accepts: isMutationResponse,
  label: 'archive deletion',
};
export const STORAGE: EndpointDefinition<StorageResponse> = {
  path: '/api/storage',
  accepts: hasStorage,
  label: 'storage report',
};
export const RECENT_EDITS: EndpointDefinition<RecentEditsResponse> = {
  path: '/api/recent-edits',
  accepts: hasFiles,
  label: 'recent edits',
};
export const RECLAIM: EndpointDefinition<ReclaimResponse> = {
  path: '/api/storage-reclaim',
  accepts: hasReclaimResult,
  label: 'storage reclaim',
};
export const FILE_HISTORY: EndpointDefinition<FileHistoryResponse> = {
  path: '/api/file-history',
  accepts: hasHistory,
  label: 'file history',
};
export const SETTINGS: EndpointDefinition<SettingsResponse> = {
  path: '/api/settings',
  accepts: hasScopes,
  label: 'settings',
};
export const SETTINGS_WRITE: EndpointDefinition<WriteSettingsResponse> = {
  path: '/api/settings-write',
  accepts: isWrittenScope,
  label: 'settings save',
};
export const RENAME_SESSION: EndpointDefinition<MutationResponse> = {
  path: '/api/session-rename',
  accepts: isMutationResponse,
  label: 'session rename',
};
export const RETENTION_STATUS: EndpointDefinition<RetentionStatusResponse> = {
  path: '/api/retention-status',
  accepts: (value): value is RetentionStatusResponse => {
    return 'policy' in value && 'due' in value;
  },
  label: 'retention status',
};
export const RETENTION_WRITE: EndpointDefinition<RetentionStatusResponse> = {
  path: '/api/retention-write',
  accepts: (value): value is RetentionStatusResponse => {
    return 'policy' in value && 'due' in value;
  },
  label: 'retention save',
};
export const RETENTION_RUN: EndpointDefinition<RunRetentionResponse> = {
  path: '/api/retention-run',
  accepts: (value): value is RunRetentionResponse => {
    return 'result' in value && typeof value.result === 'object' && value.result !== null;
  },
  label: 'retention run',
};

// The two statuses every handler answers with when it refuses a request.
export const BAD_REQUEST = 400;
export const NOT_FOUND = 404;

// A write to a session file fires a burst of watch events; the page reloads the
// same list for all of them.
export const CHANGE_DEBOUNCE_MS = 300;

// An idle event stream looks dead to anything sitting between page and server.
export const HEARTBEAT_MS = 30_000;

// How often an unwatched root is tried again. A root can be missing because the
// agent has not run yet, or refused because the kernel is out of inotify slots.
export const WATCH_RETRY_MS = 30_000;
