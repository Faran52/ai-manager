import type {
  AgentSetupBody,
  AgentSetupResponse,
  ArchiveBody,
  ArchiveDetailResponse,
  ArchivesResponse,
  CreateArchiveBody,
  CreateArchiveResponse,
  FileHistoryBody,
  FileHistoryResponse,
  ListSessionsBody,
  LoadSessionBody,
  MessagesResponse,
  MutationResponse,
  ProjectMutationBody,
  ProjectsResponse,
  ProjectStatsBody,
  PromptsResponse,
  RecentEditsBody,
  RecentEditsResponse,
  ReclaimBody,
  ReclaimResponse,
  RenameSessionBody,
  RetentionStatusResponse,
  RunRetentionResponse,
  SearchBody,
  SearchResponse,
  SessionMutationBody,
  SessionsResponse,
  SettingsBody,
  SettingsResponse,
  StatsResponse,
  StorageResponse,
  UpdateCheckResponse,
  WriteRetentionBody,
  WriteSettingsBody,
  WriteSettingsResponse,
} from './contracts';

interface EndpointDefinition<T extends object> {
  readonly path: string;
  readonly accepts: (value: object) => value is T;
  readonly label: string;
}

const isObject = (value: unknown): value is object => {
  return typeof value === 'object' && value !== null;
};

const isAgentSetupResponse = (value: object): value is AgentSetupResponse => {
  return 'setups' in value && Array.isArray(value.setups);
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

const isUpdateCheck = (value: object): value is UpdateCheckResponse => {
  return 'update' in value;
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

const hasPrompts = (value: object): value is PromptsResponse => {
  return 'prompts' in value && Array.isArray(value.prompts);
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

const hasScopes = (value: object): value is SettingsResponse => {
  return 'scopes' in value && Array.isArray(value.scopes);
};

const isWrittenScope = (value: object): value is WriteSettingsResponse => {
  return 'scope' in value && typeof value.scope === 'object' && value.scope !== null;
};

const isCreatedArchive = (value: object): value is CreateArchiveResponse => {
  return 'archive' in value && typeof value.archive === 'object' && value.archive !== null;
};

const PROJECTS: EndpointDefinition<ProjectsResponse> = {
  path: '/api/projects',
  accepts: hasProjects,
  label: 'project list',
};
const SESSIONS: EndpointDefinition<SessionsResponse> = {
  path: '/api/sessions',
  accepts: hasSessions,
  label: 'session list',
};
const MESSAGES: EndpointDefinition<MessagesResponse> = {
  path: '/api/messages',
  accepts: isMessagesPage,
  label: 'session messages',
};
const SEARCH: EndpointDefinition<SearchResponse> = {
  path: '/api/search',
  accepts: isSearchOutcome,
  label: 'search results',
};
const UPDATE_CHECK: EndpointDefinition<UpdateCheckResponse> = {
  path: '/api/update-check',
  accepts: isUpdateCheck,
  label: 'update check',
};
const STATS: EndpointDefinition<StatsResponse> = {
  path: '/api/stats',
  accepts: isStatsResponse,
  label: 'statistics',
};
const DELETE_SESSION: EndpointDefinition<MutationResponse> = {
  path: '/api/session-delete',
  accepts: isMutationResponse,
  label: 'session deletion',
};
const DELETE_PROJECT: EndpointDefinition<MutationResponse> = {
  path: '/api/project-delete',
  accepts: isMutationResponse,
  label: 'project deletion',
};
const AGENT_SETUP: EndpointDefinition<AgentSetupResponse> = {
  path: '/api/agent-setup',
  accepts: isAgentSetupResponse,
  label: 'agent setup',
};
const ARCHIVES: EndpointDefinition<ArchivesResponse> = {
  path: '/api/archives',
  accepts: hasArchives,
  label: 'archive list',
};
const ARCHIVE_READ: EndpointDefinition<ArchiveDetailResponse> = {
  path: '/api/archive-read',
  accepts: isArchiveDetail,
  label: 'archive contents',
};
const ARCHIVE_CREATE: EndpointDefinition<CreateArchiveResponse> = {
  path: '/api/archive-create',
  accepts: isCreatedArchive,
  label: 'archive creation',
};
const ARCHIVE_DELETE: EndpointDefinition<MutationResponse> = {
  path: '/api/archive-delete',
  accepts: isMutationResponse,
  label: 'archive deletion',
};
const STORAGE: EndpointDefinition<StorageResponse> = {
  path: '/api/storage',
  accepts: hasStorage,
  label: 'storage report',
};
const PROMPTS: EndpointDefinition<PromptsResponse> = {
  path: '/api/prompts',
  accepts: hasPrompts,
  label: 'prompt history',
};
const RECENT_EDITS: EndpointDefinition<RecentEditsResponse> = {
  path: '/api/recent-edits',
  accepts: hasFiles,
  label: 'recent edits',
};
const NEWEST_SESSIONS: EndpointDefinition<SessionsResponse> = {
  path: '/api/newest-sessions',
  accepts: hasSessions,
  label: 'recent sessions',
};
const RECLAIM: EndpointDefinition<ReclaimResponse> = {
  path: '/api/storage-reclaim',
  accepts: hasReclaimResult,
  label: 'storage reclaim',
};
const FILE_HISTORY: EndpointDefinition<FileHistoryResponse> = {
  path: '/api/file-history',
  accepts: hasHistory,
  label: 'file history',
};
const SETTINGS: EndpointDefinition<SettingsResponse> = {
  path: '/api/settings',
  accepts: hasScopes,
  label: 'settings',
};
const SETTINGS_WRITE: EndpointDefinition<WriteSettingsResponse> = {
  path: '/api/settings-write',
  accepts: isWrittenScope,
  label: 'settings save',
};
const RENAME_SESSION: EndpointDefinition<MutationResponse> = {
  path: '/api/session-rename',
  accepts: isMutationResponse,
  label: 'session rename',
};
const RETENTION_STATUS: EndpointDefinition<RetentionStatusResponse> = {
  path: '/api/retention-status',
  accepts: (value): value is RetentionStatusResponse => {
    return 'policy' in value && 'due' in value;
  },
  label: 'retention status',
};
const RETENTION_WRITE: EndpointDefinition<RetentionStatusResponse> = {
  path: '/api/retention-write',
  accepts: (value): value is RetentionStatusResponse => {
    return 'policy' in value && 'due' in value;
  },
  label: 'retention save',
};
const RETENTION_RUN: EndpointDefinition<RunRetentionResponse> = {
  path: '/api/retention-run',
  accepts: (value): value is RunRetentionResponse => {
    return 'result' in value && typeof value.result === 'object' && value.result !== null;
  },
  label: 'retention run',
};

const errorMessageFrom = async (response: Response, label: string): Promise<string> => {
  try {
    const body: unknown = JSON.parse(await response.text());

    if (isObject(body) && 'error' in body && typeof body.error === 'string' && body.error.length > 0) {
      return body.error;
    }
  }
  catch {
  }

  return `${label} failed (${String(response.status)})`;
};

const requestEndpoint = async <T extends object>(endpoint: EndpointDefinition<T>, body: object): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(endpoint.path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  catch {
    throw new Error(`${endpoint.label} unreachable`);
  }

  if (!response.ok) {
    throw new Error(await errorMessageFrom(response, endpoint.label));
  }

  let text = '';

  try {
    text = await response.text();
  }
  catch {
    throw new Error(`${endpoint.label} returned an unreadable body`);
  }

  try {
    const parsed: unknown = JSON.parse(text);

    if (isObject(parsed) && endpoint.accepts(parsed)) {
      return parsed;
    }
  }
  catch {
    throw new Error(`${endpoint.label} returned malformed JSON`);
  }

  throw new Error(`${endpoint.label} returned an unexpected shape`);
};

export const fetchUpdateCheck = (): Promise<UpdateCheckResponse> => {
  return requestEndpoint(UPDATE_CHECK, {});
};

export const fetchProjects = (): Promise<ProjectsResponse> => {
  return requestEndpoint(PROJECTS, {});
};

export const fetchSessions = (body: ListSessionsBody): Promise<SessionsResponse> => {
  return requestEndpoint(SESSIONS, body);
};

export const fetchMessages = (body: LoadSessionBody): Promise<MessagesResponse> => {
  return requestEndpoint(MESSAGES, body);
};

export const fetchSearch = (body: SearchBody): Promise<SearchResponse> => {
  return requestEndpoint(SEARCH, body);
};

export const fetchStats = (body: ProjectStatsBody): Promise<StatsResponse> => {
  return requestEndpoint(STATS, body);
};

export const deleteSession = (body: SessionMutationBody): Promise<MutationResponse> => {
  return requestEndpoint(DELETE_SESSION, body);
};

export const fetchStorage = (): Promise<StorageResponse> => {
  return requestEndpoint(STORAGE, {});
};

export const fetchPrompts = (): Promise<PromptsResponse> => {
  return requestEndpoint(PROMPTS, {});
};

export const fetchNewestSessions = (): Promise<SessionsResponse> => {
  return requestEndpoint(NEWEST_SESSIONS, {});
};

export const fetchRecentEdits = (body: RecentEditsBody): Promise<RecentEditsResponse> => {
  return requestEndpoint(RECENT_EDITS, body);
};

export const reclaimStorage = (body: ReclaimBody): Promise<ReclaimResponse> => {
  return requestEndpoint(RECLAIM, body);
};

export const fetchFileHistory = (body: FileHistoryBody): Promise<FileHistoryResponse> => {
  return requestEndpoint(FILE_HISTORY, body);
};

export const fetchSettings = (body: SettingsBody): Promise<SettingsResponse> => {
  return requestEndpoint(SETTINGS, body);
};

export const writeSettings = (body: WriteSettingsBody): Promise<WriteSettingsResponse> => {
  return requestEndpoint(SETTINGS_WRITE, body);
};

export const fetchArchives = (): Promise<ArchivesResponse> => {
  return requestEndpoint(ARCHIVES, {});
};

export const fetchArchive = (body: ArchiveBody): Promise<ArchiveDetailResponse> => {
  return requestEndpoint(ARCHIVE_READ, body);
};

export const createArchive = (body: CreateArchiveBody): Promise<CreateArchiveResponse> => {
  return requestEndpoint(ARCHIVE_CREATE, body);
};

export const deleteArchive = (body: ArchiveBody): Promise<MutationResponse> => {
  return requestEndpoint(ARCHIVE_DELETE, body);
};

export const fetchRetentionStatus = (): Promise<RetentionStatusResponse> => {
  return requestEndpoint(RETENTION_STATUS, {});
};

export const writeRetention = (body: WriteRetentionBody): Promise<RetentionStatusResponse> => {
  return requestEndpoint(RETENTION_WRITE, body);
};

export const runRetention = (): Promise<RunRetentionResponse> => {
  return requestEndpoint(RETENTION_RUN, {});
};

export const deleteProject = (body: ProjectMutationBody): Promise<MutationResponse> => {
  return requestEndpoint(DELETE_PROJECT, body);
};

export const renameSession = (body: RenameSessionBody): Promise<MutationResponse> => {
  return requestEndpoint(RENAME_SESSION, body);
};

export const fetchAgentSetup = (body: AgentSetupBody): Promise<AgentSetupResponse> => {
  return requestEndpoint(AGENT_SETUP, body);
};
