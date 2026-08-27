import type {
  AgentSetupBody,
  AgentSetupResponse,
  ListSessionsBody,
  LoadSessionBody,
  MessagesResponse,
  MutationResponse,
  ProjectMutationBody,
  ProjectsResponse,
  ProjectStatsBody,
  RenameSessionBody,
  SearchBody,
  SearchResponse,
  SessionMutationBody,
  SessionsResponse,
  StatsResponse,
  UpdateCheckResponse,
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
const RENAME_SESSION: EndpointDefinition<MutationResponse> = {
  path: '/api/session-rename',
  accepts: isMutationResponse,
  label: 'session rename',
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

export const deleteProject = (body: ProjectMutationBody): Promise<MutationResponse> => {
  return requestEndpoint(DELETE_PROJECT, body);
};

export const renameSession = (body: RenameSessionBody): Promise<MutationResponse> => {
  return requestEndpoint(RENAME_SESSION, body);
};

export const fetchAgentSetup = (body: AgentSetupBody): Promise<AgentSetupResponse> => {
  return requestEndpoint(AGENT_SETUP, body);
};
