import {
  AGENT_INSTALL,
  AGENT_INSTALL_CHECK,
  AGENT_SETUP,
  ARCHIVE_CREATE,
  ARCHIVE_DELETE,
  ARCHIVE_READ,
  ARCHIVES,
  DELETE_PROJECT,
  DELETE_SESSION,
  FILE_HISTORY,
  MESSAGES,
  PLUGIN_ACTION,
  PLUGIN_COSTS,
  PROJECTS,
  RECENT_EDITS,
  RECLAIM,
  RENAME_SESSION,
  RETENTION_RUN,
  RETENTION_STATUS,
  RETENTION_WRITE,
  SEARCH,
  SESSIONS,
  SETTINGS,
  SETTINGS_WRITE,
  STATS,
  STORAGE,
} from './constants';

import type { EndpointDefinition } from './constants';
import type {
  AgentInstallBody,
  AgentInstallCheckResponse,
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
  PluginActionBody,
  PluginCostsBody,
  PluginCostsResponse,
  ProjectMutationBody,
  ProjectsResponse,
  ProjectStatsBody,
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
  WriteRetentionBody,
  WriteSettingsBody,
  WriteSettingsResponse,
} from './contracts';

const isObject = (value: unknown): value is object => {
  return typeof value === 'object' && value !== null;
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

export const postPluginAction = (body: PluginActionBody): Promise<MutationResponse> => {
  return requestEndpoint(PLUGIN_ACTION, body);
};

export const checkAgentInstalls = (): Promise<AgentInstallCheckResponse> => {
  return requestEndpoint(AGENT_INSTALL_CHECK, {});
};

export const postAgentInstall = (body: AgentInstallBody): Promise<MutationResponse> => {
  return requestEndpoint(AGENT_INSTALL, body);
};

export const fetchPluginCosts = (body: PluginCostsBody): Promise<PluginCostsResponse> => {
  return requestEndpoint(PLUGIN_COSTS, body);
};
